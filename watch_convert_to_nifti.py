import json
import sys
from pathlib import Path
import argparse
import threading
import convert_to_nifti

def set_interval(task, interval):
	def schedule_task():
		set_interval(task, interval)
		task()
	t = threading.Timer(interval, schedule_task)
	t.start()
	return t

def watch_directory(data_path):
	bins = list(data_path.glob('*.bin'))
	for bin_path in bins:
		json_path = bin_path.with_suffix('.json')
		if not json_path.exists(): continue
		nifti_path = convert_to_nifti.convert(bin_path, json_path, data_path, bin_path.with_suffix('.nii.gz'))
		if not nifti_path.exists(): continue
		print(f'Converted {bin_path} to {nifti_path}')
		bin_path.unlink()
		json_path.unlink()
	return

if __name__ == "__main__":

	parser = argparse.ArgumentParser(description='Watch a folder for new .bin files (generated with lesion viewer), and convert them to nifti format.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
	parser.add_argument('-dp', '--data_path', help='The folder containing the image from which the segmentation has been generated.', required=True)
	args = parser.parse_args()

	data_path = Path(args.data_path)

	if not data_path.exists():
		sys.exit(f'Path {data_path} does not exist.')
	
	print(f'Watching {data_path}')
	
	set_interval(lambda: watch_directory(data_path), 1)
	# watch_directory(data_path)
