from importlib.metadata import metadata
import sys
from pathlib import Path
import argparse
import math
import json
import SimpleITK as sitk
import numpy as np

def set_image_info_from_header(image, meta_data): # not used

	origin = meta_data['header']['origin']
	image.SetOrigin((origin['x'], origin['y'], origin['z']))

	nifti = meta_data['header']['fileFormat']['nifti']

	pixDims = nifti['pixDims']
	image.SetSpacing((pixDims[1], pixDims[2], pixDims[3]))

	quatern_b = nifti['quatern_b']
	quatern_c = nifti['quatern_c']
	quatern_d = nifti['quatern_d']

	b = quatern_b
	c = quatern_c
	d = quatern_d

	a = math.sqrt(1.0-(b*b+c*c+d*d))

	r1 = [ -(a*a+b*b-c*c-d*d),   -(2*b*c-2*a*d),       2*b*d+2*a*c     ]
	r2 = [ -(2*b*c+2*a*d),       -(a*a+c*c-b*b-d*d),   2*c*d-2*a*b     ]
	r3 = [ 2*b*d-2*a*c,       2*c*d+2*a*b,       -(a*a+d*d-c*c-b*b) ]


	image.SetDirection(r1 + r2 + r3)

	return

def convert(binary_path, json_path, data_path, output_path):
	meta_data = None
	data = np.fromfile(str(binary_path), dtype=np.uint8)

	with open(str(json_path), 'r') as f:
		meta_data = json.load(f)
	image_dimensions = meta_data['header']['imageDimensions']

	data = data.reshape([image_dimensions['zDim'], image_dimensions['yDim'], image_dimensions['xDim'], 2])

	data = data[:,:,:,0]

	reference = sitk.ReadImage(str(data_path / meta_data['lesion']['images'][0]['file']))
	image = sitk.GetImageFromArray(data)
	
	# set_image_info_from_header(image, meta_data)
	image.CopyInformation(reference)


	sitk.WriteImage(image, str(output_path))
	return output_path

if __name__ == "__main__":

	parser = argparse.ArgumentParser(description='Convert a segmentation generated by lesion viewer (a pair of .bin and .json files) in nifti format.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
	parser.add_argument('-b', '--binary', help='The binary file (for example segmentation.bin)', required=True)
	parser.add_argument('-j', '--json', help='The json file (for example segmentation.json)', required=True)
	parser.add_argument('-dp', '--data_path', help='The folder containing the image from which the segmentation has been generated.', required=True)
	parser.add_argument('-o', '--output', help='The output nifti file', required=True)
	args = parser.parse_args()

	binary_path = Path(args.binary)
	json_path = Path(args.json)
	data_path = Path(args.data_path)
	output_path = Path(args.output)

	if not binary_path.exists():
		sys.exit(f'Path {binary_path} does not exist.')

	if not json_path.exists():
		sys.exit(f'Path {json_path} does not exist.')

	if not data_path.exists():
		sys.exit(f'Path {data_path} does not exist.')