If you are classified as both an undergrad and a graduate
==

You need to select the appropriate "career" ahead of time for each course. YES prevents you from doing this before the registration period starts, but this is trivial to bypass.

1. Open your course list, next to every course, you should see a grey button:
![](https://i.imgur.com/qGPFxmk.png)

2. Click the grey button

3. Open the Chrome/Firefox/whatever console, usually you can get to it by pressing F12 on Windows or right clicking somewhere on the page that lets you right click and hitting "Inspect Element", then clicking the console tab

4. Copy and paste this code into the console: `document.getElementById('editClassSectionForm_fields_careerCode').disabled = null`

5. Select the appropriate career, and click save

6. Repeat for every single other class

7. After this has been done, you can run the script/register for classes as usual when registration opens