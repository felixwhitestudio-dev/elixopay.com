from PIL import Image

def remove_background(image_path, output_path):
    try:
        img = Image.open(image_path)
        img = img.convert("RGBA")
        datas = img.getdata()

        newData = []
        for item in datas:
            # Change all white (also shades of whites) to transparent
            if item[0] > 220 and item[1] > 220 and item[2] > 220:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Successfully processed {image_path} -> {output_path}")

    except Exception as e:
        print(f"Error processing {image_path}: {e}")

# Process Hero Image
remove_background("/Users/felixonthecloud/.gemini/antigravity/brain/1167df6c-5d96-40bd-9f9f-4a59c971f102/hero_cartoon_character_1771046231128.png", 
                  "/Users/felixonthecloud/.gemini/antigravity/brain/1167df6c-5d96-40bd-9f9f-4a59c971f102/hero_transparent.png")

# Process Mission Image
remove_background("/Users/felixonthecloud/.gemini/antigravity/brain/1167df6c-5d96-40bd-9f9f-4a59c971f102/mission_cartoon_tech_1771046244843.png", 
                  "/Users/felixonthecloud/.gemini/antigravity/brain/1167df6c-5d96-40bd-9f9f-4a59c971f102/mission_transparent.png")
