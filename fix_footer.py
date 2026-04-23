old_file = 'old_index.html'
new_file = 'index.html'

with open(old_file, 'r', encoding='utf-8') as f:
    old = f.read()

footer_idx = old.find('<!-- Footer -->')
# Find the div closing tags before footer
div_closings = old[footer_idx-30:footer_idx]

footer_content = old[footer_idx:]

with open(new_file, 'r', encoding='utf-8') as f:
    curr = f.read()

# We need to make sure curr doesn't already have the footer
if '<!-- Footer -->' not in curr:
    # Look at the end of curr, it ends at slide 10.
    # It might need a couple of </div> to close out `slide-inner`, `split-layout`, etc.
    # We can just rely on the new python script to append:
    # 1. </div></div></div> (to close the last slide's internal divs) -> Actually the last slide already closed them! 
    # Because my python regex kept the closing </div> of the slide.
    # Wait, my regex in `reorder.py` was:
    # `(<div class="slide.*?>.*?)(?=<div class="slide"|<div class="slide active"|\Z)`
    # So `slides` actually contained the closing </div>s!
    
    # We just need to close:
    # </div> <!-- .slides-container -->
    # </div> <!-- .app-container -->
    
    closing_divs = "\n</div>\n</div>\n\n"
    
    # Update navigation total to 10 in footer
    footer_content = footer_content.replace('/ 15</div', '/ 10</div')
    footer_content = footer_content.replace('/ 16</div', '/ 10</div')

    with open(new_file, 'w', encoding='utf-8') as f:
        f.write(curr + closing_divs + footer_content)
    print("Fixed!")
