const core = require("@actions/core");
const exec = require("@actions/exec");

const validateBranchName = ({ branchName }) =>
  /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);

const validateDirectoryName = ({ dirName }) =>
  /^[a-zA-Z0-9_\-\/]+$/.test(dirName);

async function run() {
  const basebranch = core.getInput("base-branch");
  const targetBranch = core.getInput("target-branch");
  const ghToken = core.getInput("gh-token");
  const workingDir = core.getInput("working-directory");
  const debug = core.getBooleanInput("debug");

  core.setSecret(ghToken);

  if (!validateBranchName({ branchName: basebranch })) {
    core.setFailed(
      "Invalid base branch name. Brnch names should include only characters, numbers, hyphens, underscores, dots and forward slashes"
    );
    return;
  }

  if (!validateBranchName({ branchName: targetBranch })) {
    core.setFailed(
      "Invalid target branch name. Brnch names should include only characters, numbers, hyphens, underscores, dots and forward slashes"
    );
    return;
  }
  if (!validateDirectoryName({ dirName: workingDir })) {
    core.setFailed(
      "Invalid directory name. Directory names should include only characters, numbers, hyphens, underscores and forward slashes"
    );
    return;
  }

  core.info(`[js-dependency-update] : base branch is ${basebranch}`);
  core.info(`[js-dependency-update] : target branch is ${targetBranch}`);
  core.info(`[js-dependency-update] : working directory is ${workingDir}`);

  await exec.exec("npm update", [], {
    cwd: workingDir,
  });

  const gitStatus = await exec.getExecOutput(
    "git status -s package*.json",
    [],
    {
      cwd: workingDir,
    }
  );

  if (gitStatus.stdout.length > 0) {
    core.info("[js-dependency-update] : There are updates available!");
  } else {
    core.info("[js-dependency-update] : No updates at this point in time!");
  }
  /*
    1. Parse inputs
        1.1 base-branch from which to check for uodates
        1.2 target-branch to use to create the PR
        1-3 GitHub token for authentication purposes
        1.4 Working directory for which to check for dependencies

    2. Execute the NPM update command within the working directory
    3. Check whether there are modified package*.json files, 
    4. If there are modified files
        4.1 Add and commit files to the target-branch
        4.2 Create a PR to the base-branch using the octokit API
    5. Otherwise, conclude the custom action
    */
  core.info("I am a custom JS action");
}

run();
