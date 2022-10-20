import argparse
import SimpleITK as sitk

if __name__ == "__main__":

	parser = argparse.ArgumentParser(description='Reorient an image or get its orientation.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
	parser.add_argument('-i', '--image', help='The path to the image to reorient or to get orientation from.', required=True)
	parser.add_argument('-or', '--orientation', help='The orientation (three letters as defined by the DICOM standard). See DICOMOrientImageFilter from SimpleITK documentation.', default='LAS')
	parser.add_argument('-o', '--output', help='The output path of the reoriented image. If ignored, the tool will just print the image orientation.')
	args = parser.parse_args()

	image = sitk.ReadImage(args.image)
	print('Image orientation:', sitk.DICOMOrientImageFilter.GetOrientationFromDirectionCosines(image.GetDirection()))
	image = sitk.DICOMOrient(image, args.orientation)
	if args.output:
		sitk.WriteImage(image, args.output)
