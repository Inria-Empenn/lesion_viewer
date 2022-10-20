import argparse
import SimpleITK as sitk

if __name__ == "__main__":

	parser = argparse.ArgumentParser(description='Reorient an image.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
	parser.add_argument('-i', '--image', help='The path to the image to reorient.', required=True)
	parser.add_argument('-or', '--orientation', help='The orientation (three letters as defined by the DICOM standard). See DICOMOrientImageFilter from SimpleITK documentation.', default='LAS')
	parser.add_argument('-o', '--output', help='The output path of the reoriented image.', required=True)
	args = parser.parse_args()

	image = sitk.ReadImage(args.image)
	image = sitk.DICOMOrient(image, args.orientation)
	sitk.WriteImage(image, args.output)
