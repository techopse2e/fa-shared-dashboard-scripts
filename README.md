# fa-shared-dashboard-scripts
This repo contains the common scripts that used in F&A team dashboard. 
Once deployed, the scripts can be accessed with URL.

## Background
With more and more scripts used in our dashboards, there are some common part that can be abstracted and reused.
The target of this repo is to make these common scripts able to be reused as "packages".


## How to use
1. In "dev" branch, add new script under "scripts" folder;
2. Commit and push. github action will generate a new tag for the commit with "0.x.x" as version number; the second number will automatically increase for each push;
3. Refresh (purge) the dev scripts on CDN using "**refresh script**" url for dev. Do not call this URL too frequently, you will get throttled
4. The content of the dev script can be acquired by the "**get script**" url for dev;
5. If everything works fine on dev, you should create a pull request (on github) to merge the change to main branch; this will trigger another github action for generating a new tag for prod "1.x.x";
6. Similar to dev, refresh the scripts with "**refresh script**" url for prod, and access the content by the "**get script**" url for prodr

## Notes
- URLs for dev 
  - get script: https://cdn.jsdelivr.net/gh/techopse2e/fa-shared-dashboard-scripts@0/scripts/{script_name_end_with_js}}
  - refresh script: https://purge.jsdelivr.net/gh/techopse2e/fa-shared-dashboard-scripts@0/scripts/{{script_name_end_with_js}}
- URLs for production 
  - get script: https://cdn.jsdelivr.net/gh/techopse2e/fa-shared-dashboard-scripts@1/scripts/{script_name_end_with_js}}
  - refresh script: https://purge.jsdelivr.net/gh/techopse2e/fa-shared-dashboard-scripts@1/scripts/{script_name_end_with_js}}