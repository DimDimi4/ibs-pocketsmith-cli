# ibs-pocketsmith

CLI for importing scraped data from Israeli banks and credit companies to PocketSmith application

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/ibs-pocketsmith.svg)](https://npmjs.org/package/ibs-pocketsmith)
[![CircleCI](https://circleci.com/gh/dima/ibs-pocketsmith/tree/master.svg?style=shield)](https://circleci.com/gh/dima/ibs-pocketsmith/tree/master)
[![Downloads/week](https://img.shields.io/npm/dw/ibs-pocketsmith.svg)](https://npmjs.org/package/ibs-pocketsmith)
[![License](https://img.shields.io/npm/l/ibs-pocketsmith.svg)](https://github.com/dima/ibs-pocketsmith/blob/master/package.json)

<!-- toc -->

-   [Usage](#usage)
-   [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g ibs-pocketsmith
$ ibs-ps COMMAND
running command...
$ ibs-ps (-v|--version|version)
ibs-pocketsmith/0.0.0 darwin-x64 node-v12.14.0
$ ibs-ps --help [COMMAND]
USAGE
  $ ibs-ps COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

-   [`ibs-ps hello [FILE]`](#ibs-ps-hello-file)
-   [`ibs-ps help [COMMAND]`](#ibs-ps-help-command)

## `ibs-ps hello [FILE]`

describe the command here

```
USAGE
  $ ibs-ps hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ ibs-ps hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/dima/ibs-pocketsmith/blob/v0.0.0/src/commands/hello.ts)_

## `ibs-ps help [COMMAND]`

display help for ibs-ps

```
USAGE
  $ ibs-ps help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.0/src/commands/help.ts)_

<!-- commandsstop -->
