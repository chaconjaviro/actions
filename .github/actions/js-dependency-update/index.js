const core = require("@actions/core");
const exec = require("@actions/exec");
const github = require("@actions/github");

const setupGit = async () => {
  await exec.exec(`git config --global user.name "gh-automation`);
  await exec.exec(`git config --global user.email "gh-automation@email.com`);
};

const validateBranchName = ({ branchName }) =>
  /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);

const validateDirectoryName = ({ dirName }) =>
  /^[a-zA-Z0-9_\-\/]+$/.test(dirName);

const setupLogger = ({ debug, prefix } = { debug: false, prefix: "" }) => ({
  debug: (message) => {
    if (debug) {
      core.info(`DEBUG ${prefix}${prefix ? " : " : ""}${message}`);
    }
  },
  info: (message) => {
    core.info(`${prefix}${prefix ? " : " : ""}${message}`);
  },
  error: (message) => {
    core.error(`${prefix}${prefix ? " : " : ""}${message}`);
  },
});

/*
  1. Parse inputs
      1.1 base-branch from which to check for uodates
      1.2 head-branch to use to create the PR
      1-3 GitHub token for authentication purposes
      1.4 Working directory for which to check for dependencies

  2. Execute the NPM update command within the working directory
  3. Check whether there are modified package*.json files, 
  4. If there are modified files
      4.1 Add and commit files to the head-branch
      4.2 Create a PR to the base-branch using the octokit API
  5. Otherwise, conclude the custom action
  */

async function run() {
  const basebranch = core.getInput("base-branch", { required: true });
  const headBranch = core.getInput("head-branch", { required: true });
  const ghToken = core.getInput("gh-token", { required: true });
  const workingDir = core.getInput("working-directory", { required: true });
  const debug = core.getBooleanInput("debug");
  const logger = setupLogger({ debug, prefix: "[js-dependency-update]" });

  const commonExecOpts = {
    cwd: workingDir,
  };

  core.setSecret(ghToken);

  logger.debug("Validating inputs base-branch, head-branch, working-directory");

  if (!validateBranchName({ branchName: basebranch })) {
    core.setFailed(
      "Invalid base branch name. Brnch names should include only characters, numbers, hyphens, underscores, dots and forward slashes"
    );
    return;
  }

  if (!validateBranchName({ branchName: headBranch })) {
    core.setFailed(
      "Invalid head branch name. Brnch names should include only characters, numbers, hyphens, underscores, dots and forward slashes"
    );
    return;
  }
  if (!validateDirectoryName({ dirName: workingDir })) {
    core.setFailed(
      "Invalid directory name. Directory names should include only characters, numbers, hyphens, underscores and forward slashes"
    );
    return;
  }

  logger.debug(`Base branch is ${basebranch}`);
  logger.debug(`Head branch is ${headBranch}`);
  logger.debug(`Working directory is ${workingDir}`);

  logger.debug(`Checking for package update`);

  await exec.exec("npm update", [], {
    ...commonExecOpts,
  });

  const gitStatus = await exec.getExecOutput(
    "git status -s package*.json",
    [],
    {
      ...commonExecOpts,
    }
  );

  if (gitStatus.stdout.length > 0) {
    logger.debug("There are updates available!");
    logger.debug("Setting up git");
    await setupGit();

    logger.debug("Commiting and pushing package*.json changes");
    await exec.exec(`git checkout -b ${headBranch}`, [], {
      ...commonExecOpts,
    });
    await exec.exec(`git add package.json package-lock.json`, [], {
      ...commonExecOpts,
    });
    await exec.exec(`git commit -m "chore update dependencies`, [], {
      ...commonExecOpts,
    });
    await exec.exec(`git push -u origin ${headBranch} --force`, [], {
      ...commonExecOpts,
    });

    logger.debug("Fetching octokit API");
    const octokit = github.getOctokit(ghToken);

    try {
      logger.debug(`Creating PR branch using head branch ${headBranch}`);
      await octokit.rest.pulls.create({
        owner: github.context.repo.owner, //repository owner
        repo: github.context.repo.repo, //repo for which we want to create pull requests
        title: `Update NPM dependencies`,
        body: `This pull request updates NPM packages`,
        base: basebranch,
        head: headBranch,
      });
    } catch (e) {
      //Ojo, desde repository-settings->actions->General->Workflow permissions, hacer check en
      // "Allow GitHub Actions to create and approve pull requests"
      logger.error(
        "Something went wrong while creating the PR. Check logs below"
      );
      core.setFailed(e.message);
      logger.error(e);
    }
  } else {
    logger.info("No updates at this point in time!");
  }
  core.info("I am a custom JS action");
}

run();
