from pathlib import Path
import argparse
import SimpleITK as sitk

if __name__ == "__main__":

	parser = argparse.ArgumentParser(description='Reorient an image or get its orientation.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
	parser.add_argument('-i', '--image', help='Path to the image(s) to reorient or to get orientation from. If the path is a folder, process all images inside (not recursive).', required=True)
	parser.add_argument('-or', '--orientation', help='The orientation (three letters as defined by the DICOM standard). See DICOMOrientImageFilter from SimpleITK documentation. Use --all to orient the input image in all orientations, the output files will be suffixed with the three corresponding letters.', default='LAS')
	parser.add_argument('-o', '--output', help='The output path of the reoriented image(s). If ignored, the tool will just print the image(s) orientation(s).')
	args = parser.parse_args()

	input_path = Path(args.image)
	output_path = Path(args.output) if args.output else None
	image_paths = sorted(list(input_path.iterdir())) if input_path.is_dir() else [input_path]
	for image_path in image_paths:
		image = sitk.ReadImage(image_path)
		print('Image orientation:', sitk.DICOMOrientImageFilter.GetOrientationFromDirectionCosines(image.GetDirection()))
		if output_path is not None:
			if input_path.is_dir(): output_path.mkdir(exist_ok=True, parents=True)
			orientations = ['LAI', 'LAS', 'LPI', 'LPS', 'RAI', 'RAS', 'RPI', 'RPS'] if args.orientation == 'all' else args.orientation
			for orientation in orientations:
				image = sitk.DICOMOrient(image, orientation)
				image_path = output_path / image_path.name if input_path.is_dir() else output_path
				if args.orientation == 'all':
					image_stem = image_path.stem if not image_path.name.endswith('.nii.gz') else image_path.name[:-len('.nii.gz')]
					image_path = image_path.parent / f'{image_stem}_{orientation}_{"".join(image_path.suffixes)}'
				sitk.WriteImage(image, image_path)
