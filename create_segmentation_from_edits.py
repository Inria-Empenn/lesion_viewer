import sys
from pathlib import Path
import argparse
import math
import json
import SimpleITK as sitk
import numpy as np


def convert(task_path, image_folder_path, output_path):

	with open(str(task_path), 'r') as f:
		task = json.load(f)
	
	for lesion in task['lesions']:
		if 'edits' not in lesion: continue
		print(lesion['name'])

		# segmentation_name = None
		# for image in lesion['images']:
		# 	if 'editable' in image and image['editable'] and 'image_type' in image and image['image_type'] == 'segmentation': 
		# 		segmentation_name = image['file']
		# 		break
		image_name = lesion['images'][0]['file']
		reference = sitk.ReadImage(str(image_folder_path / image_name))
		image_data = sitk.GetArrayFromImage(reference)
		image_data = np.zeros(image_data.shape)

		for edit in lesion['edits']:
			print('   edit', edit)
			image_data.flat[edit['offset']] = edit['brush_value']
			# image_data[-edit['z'], -edit['y'], -edit['x']] = 1

			# image_data[edit['x'], edit['y'], edit['z']] = 1
			# image_data[edit['y'], edit['x'], edit['z']] = 3
			# image_data[edit['x'], edit['z'], edit['y']] = 4
			# image_data[edit['z'], edit['x'], edit['y']] = 5
			# image_data[edit['y'], edit['z'], edit['x']] = 6

			# image_data[edit['z'], -edit['y'], -edit['x']] = 2
			# image_data[-edit['z'], edit['y'], -edit['x']] = 3
			# image_data[-edit['z'], -edit['y'], edit['x']] = 4
			# image_data[edit['z'], edit['y'], -edit['x']] = 5
			# image_data[edit['z'], -edit['y'], edit['x']] = 6
			# image_data[-edit['z'], edit['y'], edit['x']] = 7
		# for i in range(8):
		# 	flipped_image_data = image_data.copy()
		# 	print('flip with i=', i)
		# 	for a in range(3): 
		# 		if (i >> a) & 1:
		# 			print('   flip', a)
		# 			flipped_image_data = np.flip(flipped_image_data, a)
			
		image = sitk.GetImageFromArray(image_data)
		# image = sitk.BinaryDilate(image)
		image.CopyInformation(reference)
		sitk.WriteImage(sitk.Cast(image, sitk.sitkUInt8), str(output_path / image_name.replace('.nii.gz', f'_segmentation_{i}.nii.gz')))

	return output_path

if __name__ == "__main__":

	parser = argparse.ArgumentParser(description='Create a segmentation from task edits.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
	parser.add_argument('-if', '--image_folder', help='The folder containing all task images', required=True)
	parser.add_argument('-t', '--task', help='The task file (for example task.json)', required=True)
	parser.add_argument('-o', '--output', help='The output nifti file', required=True)
	args = parser.parse_args()

	task_path = Path(args.task)
	image_folder_path = Path(args.image_folder)
	output_path = Path(args.output)
	output_path.mkdir(exist_ok=True, parents=True)

	convert(task_path, image_folder_path, output_path)