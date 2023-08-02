from pathlib import Path
import shutil
images = Path('images')
flat_images = Path('flat_images')

for patient in sorted(list(images.iterdir())):
	for ttype in sorted(list(patient.iterdir())):
		for image in sorted(list(ttype.iterdir())):
			print(image)
			shutil.copyfile(image, flat_images / f"{patient.name}_{ttype.name}_{image.name}")