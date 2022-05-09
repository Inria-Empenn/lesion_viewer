import json
from pathlib import Path
Path.ls = lambda x: list(x.iterdir())
import SimpleITK as sitk

music_flair_testing_raw = Path('/data/msStudy/datasets/musicFlairTesting/raw/')
music_flair_testing = Path('/data/amasson/datasets/musicFlairTesting/')

# music_flair_testing_archive will contain all images required for the task (can contain more images)
music_flair_testing_archive = music_flair_testing / 'all'

# Initialize the fields which will be displayed on the table of the viewer
# Here there are two checkboxes "new" and "growing"
fields = [
    { 'field': 'new', 'sortable': True, 'resizable': True, 'filter': True, 'editable': True, 'longiseg_type': 'bool' },
    { 'field': 'growing', 'sortable': True, 'resizable': True, 'filter': True, 'editable': True, 'longiseg_type': 'bool' },
]

# This is the task
task = { 'lesions': [], 'fields': fields }

def get_bounding_box_center(bounding_box):
    return [ (bounding_box[0] + bounding_box[1]) // 2, (bounding_box[2] + bounding_box[3]) // 2, (bounding_box[4] + bounding_box[5]) // 2 ]

# For all patients: extract the lesions and add them to the task
for patient in music_flair_testing_raw.iterdir():
    print(patient.name)
	
	# Load and threshold the ground truth
    ground_truth_path = music_flair_testing_archive / f'{patient.name}_mGT.nii.gz'
    segmentation_image = sitk.ReadImage(str(ground_truth_path), sitk.sitkFloat64)
    thresholded_segmentation = sitk.BinaryThreshold(segmentation_image, 0.5)
	
	# Get connected components
    ccifilter = sitk.ConnectedComponentImageFilter()
    ccifilter.SetFullyConnected(True)
    labeled = ccifilter.Execute(thresholded_segmentation)
    labeled_data = sitk.GetArrayFromImage(labeled)
    n_components = ccifilter.GetObjectCount()
	
	# Get the bounding boxes of the components
    lsifilter = sitk.LabelStatisticsImageFilter()
    lsifilter.Execute(labeled, labeled)
    print('    n lesions: ', n_components)

	# Add all lesions to the task
    for lesion_index in range(1, n_components+1):
        
        bounding_box = lsifilter.GetBoundingBox(lesion_index)
        center_voxel = get_bounding_box_center(bounding_box)
        center = segmentation_image.TransformIndexToPhysicalPoint(center_voxel)

        patient_name = f'{patient.name}'
        
		# The list of images for the lesion with the following fields:
		# - parameters are Papaya images options (see https://github.com/rii-mango/Papaya/wiki/Configuration#image-options)
		#   see the trick to display label images with different colors using the same look-up table (LUT): max is different for the three experts
		# - display indicates if the image will be displayed by default or not
        images = [
            { 'name': 'time01', 'file': f'{patient_name}_flair_time01.nii.gz', 'parameters': {'minPercent': 0, 'maxPercent': 1, 'lut': 'Grayscale'}, 'display': True }, 
            { 'name': 'time02', 'file': f'{patient_name}_flair_time02.nii.gz', 'parameters': {'minPercent': 0, 'maxPercent': 1, 'lut': 'Grayscale'}, 'display': True }, 
            { 'name': 'expert1', 'file': f'{patient_name}Exp1.nii.gz', 'parameters': {'min': 0, 'max': 2, 'lut': 'Green Overlay'}, 'display': False }, 
            { 'name': 'expert2', 'file': f'{patient_name}Exp2.nii.gz', 'parameters': {'min': 0, 'max': 3, 'lut': 'Green Overlay'}, 'display': False }, 
            { 'name': 'expert3', 'file': f'{patient_name}Exp3.nii.gz', 'parameters': {'min': 0, 'max': 4, 'lut': 'Green Overlay'}, 'display': False }, 
            { 'name': 'ground_truth', 'file': f'{patient_name}_mGT.nii.gz', 'parameters': {'min': 0, 'max': 2, 'lut': 'Blue Overlay'}, 'display': True },
        ]

        task['lesions'].append({
            'name': f'{patient_name}_{lesion_index}', 		# Each lesion name must be unique, required to be able to retrieve the lesion for later processes
            'location': center,								# The center of the lesion in physical space (optional, the location in voxel is used)
            'location_voxel': center_voxel,					# The center of the lesion in voxel space
            'description': f'Patient: {patient_name}, lesion: {lesion_index}', 	# The description of the lesion
            'new': True,									# The lesion is new by default, but it will be modified by the user since the "new" field is editable
            'growing': False,								# The lesion is not growing by default
            'images': images,								# The list of images for the lesion
        })
	
	# Save the labeled image to use it for later processes
    sitk.WriteImage(labeled, str(music_flair_testing_archive / f'{patient.name}_gt_labeled.nii.gz'))

# Save the task	
with open(str(music_flair_testing_archive / 'task.json'), 'w') as f:
    json.dump(task, f, indent=4)

