import sys
import argparse
import json
from pathlib import Path
import pandas

def convert_json_to_csv(json_path, output_path):
	with open(json_path, 'r') as f:
		task = json.load(f)

		if 'lesions' not in task:
			sys.exit(f'Json file has no lesions list.')
		
		records = []
		for lesion in task['lesions']:
			record = {}
			for key, value in lesion.items():
				if type(value) is float or type(value) is str or type(value) is int:
					record[key] = value
			records.append(record)
		df = pandas.DataFrame.from_records(records)
		df.to_csv(output_path, index=False)
	return

if __name__ == "__main__":

	parser = argparse.ArgumentParser(description='Convert a json task file to a csv file.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
	parser.add_argument('-j', '--json', help='The json file', required=True)
	parser.add_argument('-o', '--output', help='The output csv file', required=True)
	args = parser.parse_args()

	json_path = Path(args.json)
	output_path = Path(args.output)

	if not json_path.exists():
		sys.exit(f'Path {json_path} does not exist.')

	convert_json_to_csv(json_path, output_path)