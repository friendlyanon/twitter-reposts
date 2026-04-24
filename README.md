# Mark reposts on Twitter (now X)

Identify reposts on users' Media tab on Twitter (now X).

[Install](https://raw.githubusercontent.com/friendlyanon/twitter-reposts/master/twitter-reposts.user.js)

# How to use

- Navigate to a user's Media tab.
- Locate the `XXX photos & videos` text at the top of the page
- Click the cog for settings
- Click `Dedupe` to start scanning for reposts
- Scroll down to load images for scanning
- Suspected reposts will have reduced opacity
- Click the 3 dot button in the top right to compare the repost and the original
- Click `Stop` to stop

# Known limitations

This script is more of a proof-of-concept right now.

- The perceptual hashing algorithm is suboptimal.
  - If a repost is cropped slightly, then the hash can be too different.
  - Works by using a grayscale sample.
- The script's UI and modifications are intended for the AMOLED dark theme.
- State is kept for longer than necessary.
  - Refer to `idMap`.
  - Needs better hooking into the site's React code.
- Script UI is not responsive.
- Comparing reposts and the original could select which is which better.
  - If a repost is higher resolution, but otherwise 100% similar, then it should be considered the original.

## Limited history on the Media tab

When scrolling to the bottom of the Media tab, Twitter will only return up to ~850 posts.
Anything beyond that cannot be considered for finding reposts and limits the script's usability.
This is one of the biggest limitations when accounts with very frequent reposts and irrelevant (not art) posts are considered.

My current idea is to make a separate userscript that extends this ~850 limit using the search page.
This has its own caveats, because `until:` and `since:` ranges can return posts inconsistently.
