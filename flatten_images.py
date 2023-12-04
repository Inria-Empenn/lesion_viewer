from pathlib import Path
import shutil

data_path = Path('data/')
flat_data_path = Path('flat_data/')
flat_data_path.mkdir(exist_ok=True, parents=True)

files = data_path.glob('**/*')
for file in files:
	if file.is_dir(): continue
	destination = flat_data_path / str(file.relative_to(data_path)).replace('/', '__')
	shutil.copyfile(file, destination)