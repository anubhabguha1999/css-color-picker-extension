import os
import sys

# Ensure Pillow is imported, or install it if missing
try:
    from PIL import Image
except ImportError:
    print("Pillow is not installed. Installing Pillow...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--break-system-packages", "pillow"])
    from PIL import Image

source_path = "/Users/mac/.gemini/antigravity/brain/33838ae2-7871-469c-8e54-78114d859c83/chromalux_icon_source_1779597589368.png"
dest_dir = "/Users/mac/Desktop/This PC/Git/css-color-picker-extension/icons"

os.makedirs(dest_dir, exist_ok=True)

try:
    if not os.path.exists(source_path):
        print(f"Source file not found at {source_path}")
        sys.exit(1)
        
    img = Image.open(source_path)
    
    # We want to crop slightly to remove the bottom reflection standalone ring or let it be.
    # The source is 1024x1024. Let's crop it slightly if we want it to be perfectly centered,
    # but the AI isolated it nicely. Let's do a central crop just to be safe if there is excess space.
    width, height = img.size
    
    # Let's resize it to the standard extension icon sizes
    sizes = [16, 48, 128]
    for size in sizes:
        resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
        resized_img.save(os.path.join(dest_dir, f"icon{size}.png"))
        print(f"Generated: icon{size}.png")
    
    print("All Chrome Extension icons have been successfully generated!")
except Exception as e:
    print(f"An error occurred while generating icons: {e}")
    sys.exit(1)
