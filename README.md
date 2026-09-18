# Pharmacy Batch 49 Website

Static HTML/CSS/JavaScript website for GitHub Pages.

## Run locally
Open `index.html` in a browser.

## Publish on GitHub Pages
1. Create a new GitHub repository.
2. Upload all files and folders from this project (not the outer ZIP folder).
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`.
6. Save. GitHub will give you the website URL.

## Adding any premium word to a student
Open `js/script.js` and add `badge: 'YOUR WORD'` to the student's data. The word can be anything, for example `VIP`, `LEADER`, `FOUNDER`, or `STAR`. It will automatically use the same premium gold style. Remove `badge` if you do not want a label.

## Editing Featured Doctors
The featured doctors are also defined in `js/script.js`. Add another doctor object following the existing example.
