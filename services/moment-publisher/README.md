# Moment Publisher Worker

This private service accepts the owner password, issues a four-hour signed session token, and creates one atomic Git commit containing the Moment Markdown file and up to nine JPEG images.

The form supplies the post date in Asia/Shanghai time. New photos are written to
`img/_Moment/` with filenames in `YYYY-MM-DD-HHMMSS-random-NN.jpg` format, and
the same date is stored in the Moment front matter.

Required Cloudflare encrypted secrets:

- `PUBLISH_PASSWORD`: the password used on the phone.
- `SESSION_SECRET`: a random value of at least 32 bytes.
- `GITHUB_TOKEN`: a fine-grained GitHub token restricted to `QianyuXIE.github.io` with **Contents: Read and write**.

The public repository never contains these values. See the root README for setup and deployment commands.

The browser sends a short-lived signed bearer token after login. It is kept in
`sessionStorage`, so closing the tab removes the local session. The publishing
page deliberately uses a local-only layout with no third-party JavaScript.

Run `npm test` before deployment. The test suite exercises origin checks,
password validation, token tampering, file limits, Markdown generation, and the
single-commit GitHub Git Data API flow without making network requests.
