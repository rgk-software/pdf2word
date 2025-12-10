from PIL import Image
import os

def resize_icon(input_path, output_dir):
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        img = Image.open(input_path)
        
        sizes = [192, 512]
        
        for size in sizes:
            new_img = img.resize((size, size), Image.Resampling.LANCZOS)
            output_path = os.path.join(output_dir, f"icon-{size}.png")
            new_img.save(output_path)
            print(f"Created {output_path}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    resize_icon("public/icons/icon_original.png", "public/icons")
