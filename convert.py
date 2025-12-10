import sys
from pdf2docx import Converter

def convert_pdf_to_docx(pdf_file, docx_file):
    try:
        cv = Converter(pdf_file)
        cv.convert(docx_file)
        cv.close()
        print("Conversion Successful")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python convert.py <input_pdf> <output_docx>")
        sys.exit(1)
    
    input_pdf = sys.argv[1]
    output_docx = sys.argv[2]
    
    convert_pdf_to_docx(input_pdf, output_docx)
