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

## Adding a memorial card for a deceased student
Open `js/script.js` and add `memorial: true` to that student's data in the `students` array. Their card will automatically switch to a special style (black-and-white photo, a dark "In Loving Memory" ribbon, and "رحمه الله" under the name) instead of the normal gold badge style. When someone clicks/taps the card, it flips over and shows a dua/prayer on the back. Customize the text with:
- `memorialText: 'your text here'` — the short line shown under the name on the front (default: `رحمه الله`)
- `memorialDua: 'your dua here'` — the full text shown on the back when the card is flipped (default: a general dua)

Example:
```js
{
  name: 'اسم الطالب',
  photo: 'images/students/photo.jpg',
  memorial: true,
  memorialText: 'في ذكراه الطيبة',
  memorialDua: 'اللهم اغفر له وارحمه وأسكنه فسيح جناتك',
},
```

## Editing Featured Doctors
The featured doctors are also defined in `js/script.js`. Add another doctor object following the existing example.
