## Website app for user prompt creation

The app allows someone non-techincal to design frontend prompts that can be fed into claude code to one-shot a frontend UI.


1. I need a webapp in React that has a section on the left (a column with a bunch of options for the user to select).
2. These options are component blocks that could include images, button types, links, color options, menu items and more.
3. On the right side (main area) of the webapp should have a funnel with different sections: tech Stack, Theme, Product details, Images in that order from top to bottom.
4. The product details area is a text box that the user can type.
5. The images area should be an upload area or a image link paste from the web.
6. There should be a button on the bottom that helps you create a claude system prompt to generate the website based on the ideas I added to the funnel.
7. I can link up a claude api key. The button on the bottom should call claude with the system prompt of what I want to do and items from the website. The output should be a markdown file with all these details.
8. The idea is that a non-technical person who has a mom and pop business can drag and drop items from the left section to create the funnel structure and eventually a markdown file that can be referenced by claude code to one-shot the frontend
9. I need a light theme, dark theme, and akita theme with memecoin stuff.
10. The website should be called akita

Important Teammate requirements:
1. I have a teammate who will take the generated prompt and provide that to a claude agent to generate the UI.
2. Those changes should update the Ctrl+G part of claude code with the new temp md claude file.
3. He will be using Agents SDK with Claude
4. Make the code base be capable of doing these changes

XTerm changes:
1. When the user click the generate prompt button, I need a xterm.js window to open the left that is read only but shows all the steps that claude is taking to build this out
