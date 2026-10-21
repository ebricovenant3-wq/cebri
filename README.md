# Cebri Curtains & Blinds

A static storefront built with HTML, CSS and JavaScript. It has no build step or server-side order storage. Product searches, category filters, cart quantities, and an installation service request are included.

## Local preview

Serve this folder with any static web server, then open `index.html`. The shop page is `shop.html`.

## Business settings

Edit the constants at the top of `script.js` to update the WhatsApp number and business email. Add verified bank name, account name and account number to `BANK_TRANSFER_DETAILS` when ready. The checkout sends an order review request through WhatsApp (or email if WhatsApp is unset); Cebri confirms the quote and sends bank-transfer instructions manually after reviewing the request. The page does not accept or verify payments. Cart contents are saved in the visitor's browser; order form details are sent through the selected contact app and are not saved to a server.

## Free static hosting with GitHub Pages

This site can be published directly from the repository root; it does not need a build command. In the GitHub repository, open **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**, then save. GitHub Pages is available for public repositories on GitHub Free. See [GitHub's Pages publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
