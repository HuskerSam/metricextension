# metricextension



### tailwind

#### npx tailwindcss -i .\style\main.css -o .\style\output.css --watch

-specific paths were defined for content in tailwind.config.js rather than the glob paths (* wildcards), meaning adjustments will need to be made when adding new JS (that generate css class) or HTML files.

-when working with any third-party libraries, write custom css to overwrite default and place the css before the "@tailwind utilities" in the input css file.

-Safelisting can be a a last-resort where it’s impossible to scan certain content for class names

##### This project uses https://heroicons.com/ for svg icons 