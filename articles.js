const util = require('util');
const fs = require('fs');
const path = require('path');
const express = require('express');
const MarkdownIt = require('markdown-it');
const matter = require('gray-matter');

const router = express.Router();

const readdirAsync = util.promisify(fs.readdir);
const readFileAsync = util.promisify(fs.readFile);

const md = new MarkdownIt();

const articlesPath = './articles';

function catchErrors(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

/**
 * Les grein úr filePath og skilar efni hennar, bæði lýsigögnum úr frontmatter
 * og efni þáttuðu úr Markdown.
 *
 * @param {string} filePath Slóð á grein
 * @returns {Promise} Promise sem mun innihalda gögn greinar
 */
async function readArticle(filePath) {
  const file = await readFileAsync(filePath);

  const data = matter(file);

  const {
    content,
    data: { // gray-matter pakki skilar efni í content og lýsigögnum í data
      title,
      slug,
      date,
      image,
    },
  } = data;

  return {
    content: md.render(content),
    title,
    slug,
    date: Date.parse(date),
    image,
    path: filePath,
  };
}

/**
 * Les upp allar greinar sem hafa endingu .md í articlesPath möppu
 *
 * @returns {Promise} Promise sem mun innihalda fylki af öllum greinum
 */
async function readArticlesList() {
  const files = await readdirAsync(articlesPath);

  const articles = files
    .filter(file => path.extname(file) === '.md')
    .map(file => readArticle(`${path.join(articlesPath, file)}`));

  return Promise.all(articles);
}

/**
 * Skrifar út allar greinar í öfugri tímaröð með `articles.ejs` sniðmáti.
 *
 * @param {object} req - request
 * @param {object} res - response
 */
async function list(req, res) {
  const title = 'Greinasafnið';
  const articles = await readArticlesList();
  const articlesSorted = articles.sort((a, b) => a.date < b.date);

  res.render('articles', { title, articles: articlesSorted });
}

/**
 * Skrifar út staka grein eftir `slug` param úr route. Ef grein finnst ekki
 * er kallað í next()
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
async function article(req, res, next) {
  const { slug } = req.params;

  const articles = await readArticlesList();

  const foundArticle = articles.find(a => a.slug === slug);

  if (!foundArticle) {
    // hér væri líka hægt að skila 404 þar sem við erum að meðhöndla allt
    // með `:/slug`
    return next();
  }

  const { title } = foundArticle;

  return res.render('article', { title, article: foundArticle });
}

router.get('/', catchErrors(list));
router.get('/:slug', catchErrors(article));

module.exports = router;
