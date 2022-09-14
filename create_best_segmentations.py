import sys
from pathlib import Path
import argparse
import math
import json
import SimpleITK as sitk
import numpy as np
import convert_to_nifti

# Parse args

parser = argparse.ArgumentParser(description='Create the best segmentations as described with lesion viewer.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('-t', '--task', help='The task file (for example task.json)', required=True)
parser.add_argument('-dp', '--data_path', help='The folder containing the images.', required=True)
parser.add_argument('-s', '--suffix', help='The suffix of the generated best segmentation files (will have the format "otherImagesPrefix_suffix.nii.gz")', default='best_segmentation')
args = parser.parse_args()

task_path = Path(args.task)
data_path = Path(args.data_path)

if not task_path.exists():
	sys.exit(f'Path {task_path} does not exist.')

if not data_path.exists():
	sys.exit(f'Path {data_path} does not exist.')

task = None
with open(str(task_path), 'r') as f:
	task = json.load(f)

final_ground_truth_path = data_path / 'final_ground_truth'
final_ground_truth_path.mkdir(exist_ok=True)

# For each lesion entry: comupte the entire best segmentation image, then extract only the region corresponding to the lesion, and update the patient ground truth accordingly (initialize at zero)
for lesion in task['lesions']:
	
	print(lesion['name'])
	if not 'best_segmentation' in lesion:
		print('ERROR: best_segmentation is null for lesion', lesion['name'], '.')
		continue
	
	# The best segmentation is defined as the union of all segmentations in the 'best_segmentation' field ; possibly thresholded with a given value
	# the 'best_segmentation' field has the following format: 'image1_name + image2_name:0.4 + image3_name' 
	# here the segmentation will be the union of image1_name, image2_name thresholded at 0.4, and image3_name.
	# the images can either be the ground_truth, a pmap (which must be given with a threshold), a segmentation, or a new_segmentation generated with the drawing tool
	best_segmentations = lesion['best_segmentation'].split(' + ')
	patient = lesion['patient']
	final_segmentation_image = None
	
	# Extract the first image path in the list of images for the lesion
	# We can then deduce the path of the other images by replacing its name by the one we want
	image_name_to_file = {image['name']: image['file'] for image in lesion['images']}
	first_image_name = lesion['images'][0]['name']
	first_image_file = lesion['images'][0]['file']
	lesion_type = lesion['type']

	# The reference image for this lesion is either the ground_truth if the lesion is a True Positive or a False Negative, or a model segmentation otherwise
	model_name = lesion['description'].split(',')[0][len('Model: '):]
	reference_name = 'ground_truth' if lesion_type in ['TP', 'FN'] else 'segmentation'
	reference_image_path = data_path / image_name_to_file[reference_name]
	reference_image = sitk.ReadImage(str(reference_image_path), sitk.sitkUInt8)

	# Label the reference image
	ccifilter = sitk.ConnectedComponentImageFilter()
	ccifilter.SetFullyConnected(True)
	reference_labeled = ccifilter.Execute(reference_image)
	reference_labeled_data = sitk.GetArrayFromImage(reference_labeled)
	reference_n_components = ccifilter.GetObjectCount()
	
	# For each 'best_segmentation': threshold if necessary and add it to the final_segmentation (union)
	for best_segmentation in best_segmentations:
		
		# Parse threshold
		threshold = None
		best_segmentation_parts = best_segmentation.split(':')
		if len(best_segmentation_parts) > 1:
			threshold = float(best_segmentation_parts[-1])
			best_segmentation = best_segmentation_parts[0]
		
		# Find the path of this best_segmentation in the lesion images
		best_segmentation_path = None
		for image in lesion['images']:
			if image['name'] == best_segmentation:
				best_segmentation_path = data_path / image['file']
				break

		# best_segmentation_path = data_path / filter(lambda image: image['name'] == best_segmentation, lesion['images'])['file']

		# If the best_segmentation is not in the lesion images, it probably means that it is the new_segmentation generated with the drawing tool:
		# Find the new_semgentation.bin and new_segmentation.json, convert them to nifti, and use this image as best_segmentation
		if not best_segmentation_path:
			image_name = first_image_file.replace(first_image_name, best_segmentation)[:-len('.nii.gz')]
			binary_path = data_path / f'{image_name}.bin'
			json_path = data_path / f'{image_name}.json'
			
			if binary_path.exists() and json_path.exists():
				best_segmentation_path = convert_to_nifti.convert(binary_path, json_path, data_path, data_path / f'{image_name}.nii.gz')

		# If we found the best_segmentation: threshold if necessary and add it to the final_segmentation ; else: print and error
		if best_segmentation_path and best_segmentation_path.exists():
			best_segmentation_image = sitk.ReadImage(str(best_segmentation_path), sitk.sitkFloat64)
			if threshold is not None:
				best_segmentation_image = sitk.BinaryThreshold(best_segmentation_image, threshold, 1)

			if final_segmentation_image is None:
				final_segmentation_image = sitk.Cast(best_segmentation_image, sitk.sitkUInt8)
			else:
				import ipdb; ipdb.set_trace()
				print(best_segmentations)
				print(best_segmentation)
				sitk.WriteImage(best_segmentation_image, '/data/amasson/test/a0.nii.gz')
				sitk.WriteImage(final_segmentation_image, '/data/amasson/test/a1.nii.gz')
				final_segmentation_image = final_segmentation_image | sitk.Cast(best_segmentation_image, sitk.sitkUInt8)
				sitk.WriteImage(final_segmentation_image, '/data/amasson/test/a2.nii.gz')
		else:
			print('ERROR: ', best_segmentation, 'not found: path ', best_segmentation_path, ' does not exist.')
	
	# If we computed a final_segmentation_image: update the new ground truth for the lesion patient 
	if final_segmentation_image is not None:

		# Label the final_segmentation to get the entire region under the lesion in the reference image
		final_segmentation_labeled = ccifilter.Execute(final_segmentation_image)
		final_segmentation_labeled_data = sitk.GetArrayFromImage(final_segmentation_labeled)
		lesion_data = final_segmentation_labeled_data[reference_labeled_data == lesion['index']]

		# The entire region is the one which has the most frequent label under the lesion: 
		# compute the number of occurence of each values, then find the argmax to get the most frequent value
		# ignore the zero values, so the argmax must be incremented
		biggest_lesion_index = np.argmax(np.bincount(lesion_data.flatten())[1:]) + 1
		
		# Find the new patient ground truth: if it does not exist, initialize it with zero values (from the initial ground truth)
		patient_ground_truth_path = final_ground_truth_path / str(lesion['patient'] + '.nii.gz')
		
		if patient_ground_truth_path.exists():
			patient_ground_truth_image = sitk.ReadImage(str(patient_ground_truth_path), sitk.sitkUInt8)
			patient_ground_truth_image_data = sitk.GetArrayFromImage(patient_ground_truth_image)
		else:
			patient_ground_truth_image = sitk.ReadImage(str(data_path / image_name_to_file['ground_truth']), sitk.sitkUInt8)
			patient_ground_truth_image_data = np.zeros(sitk.GetArrayFromImage(patient_ground_truth_image).shape)

		# Update the new patient ground truth and save it 
		patient_ground_truth_image_data[final_segmentation_labeled_data == biggest_lesion_index] = 1
		patient_final_ground_truth_image = sitk.GetImageFromArray(patient_ground_truth_image_data)
		patient_final_ground_truth_image.CopyInformation(patient_ground_truth_image)
		sitk.WriteImage(patient_final_ground_truth_image, str(patient_ground_truth_path))