import re

file_path = '/Users/gideonnweze/Documents/DIBA.v3/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Separate header, slides, and footer
header_end = content.find('<!-- ============ SLIDE 1')
if header_end == -1:
    header_end = content.find('<div class="slide active"')

# Find the start of controls
footer_start = content.find('<!-- ============ CONTROLS')
if footer_start == -1:
    footer_start = content.find('<div class="progress-bar')

header = content[:header_end]
footer = content[footer_start:]
slides_content = content[header_end:footer_start]

# Split the slides content by looking for <div class="slide" (and optionally " active")
slide_pattern = re.compile(r'(<div class="slide.*?>.*?)(?=<div class="slide"|<div class="slide active"|\Z)', re.DOTALL)
slides = slide_pattern.findall(slides_content)

print(f"Found {len(slides)} slides.")

# Clean up slides just to be sure we don't have empty strings
cleaned_slides = [s for s in slides if '<div class="slide' in s]

print(f"Cleaned slides: {len(cleaned_slides)}")

if len(cleaned_slides) >= 15:
    # Target mapping
    keep_indices = [1, 3, 4, 9, 12, 6, 8, 11, 14, 15]
    
    new_slides = []
    for new_idx, orig_idx in enumerate(keep_indices, 1):
        slide_html = cleaned_slides[orig_idx - 1]
        
        # Strip trailing/leading spaces if any, though regex keeps them
        # Let's just fix the ID and data-slide
        slide_html = re.sub(r'id="slide-\d+"', f'id="slide-{new_idx}"', slide_html)
        slide_html = re.sub(r'data-slide="\d+"', f'data-slide="{new_idx}"', slide_html)
        
        # Fix <!-- ============ SLIDE X comments if they exist inside
        slide_html = re.sub(r'<!-- ============ SLIDE \d+.*?============ -->', f'<!-- ============ SLIDE {new_idx} ============ -->', slide_html)
        
        # Ensure correct active class
        if new_idx == 1:
            if 'class="slide"' in slide_html:
                slide_html = slide_html.replace('class="slide"', 'class="slide active"')
        else:
            slide_html = slide_html.replace('class="slide active"', 'class="slide"')
            
        # If the slide had a previous <!-- comment at the TOP, let's prepend it if our regex missed it.
        # Actually our regex might have consumed the comment as part of the previous slide?
        # Oh wait, the `slides_content` has comments before `div`. The regex `<div class="slide.*?>.*?` 
        # WON'T match preceding HTML comments!!
        pass
        
    # Better logic: split securely by `<!-- ============ SLIDE `
    test_split = re.split(r'(?=<!-- ============ SLIDE \d+)', slides_content)
    test_split = [s for s in test_split if 'class="slide' in s]
    
    if len(test_split) >= 15:
        print("Using HTML comment split method...")
        new_slides_c = []
        for new_idx, orig_idx in enumerate(keep_indices, 1):
            s_html = test_split[orig_idx - 1]
            s_html = re.sub(r'<!-- ============ SLIDE \d+.*?============ -->', f'<!-- ============ SLIDE {new_idx} ============ -->', s_html)
            s_html = re.sub(r'id="slide-\d+"', f'id="slide-{new_idx}"', s_html)
            s_html = re.sub(r'data-slide="\d+"', f'data-slide="{new_idx}"', s_html)
            if new_idx == 1:
                if 'class="slide active"' not in s_html:
                    s_html = s_html.replace('class="slide"', 'class="slide active"')
            else:
                s_html = s_html.replace('class="slide active"', 'class="slide"')
            new_slides_c.append(s_html)
            
        new_content = header + "".join(new_slides_c) + footer
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Successfully restructured deck.")
    else:
        print("Failed to split by comments.")

# Then script.js
script_path = '/Users/gideonnweze/Documents/DIBA.v3/script.js'
with open(script_path, 'r', encoding='utf-8') as f:
    script_content = f.read()

script_content = re.sub(r'const totalSlides = \d+;', 'const totalSlides = 10;', script_content)
# Fix the product tag logic? Product tag was on slides 5,6. In new deck, Product slide is slide 6. So let's make it 6.
script_content = re.sub(r'const PRODUCT_SLIDES = new Set\(\[.*?\]\);', 'const PRODUCT_SLIDES = new Set([6]);', script_content)


with open(script_path, 'w', encoding='utf-8') as f:
    f.write(script_content)

print("Updated script.js to 10 slides.")
