#!/bin/env bash

PARTNO="^[[:space:]]+([[:alnum:]]+)[[:space:]]+= "
NAMES="([[:alnum:]]+)(, ([[:alnum:]]+))?(, ([[:alnum:]]+))?"
MODES1=" \((.*)\)"

REGEX1="${PARTNO}${NAMES}${MODES1}"
REPL1='  {"partno": "\1", "names": ["\2", "\4", "\6"], "modes": #\7#},'

MODES2="([[:alnum:]]+)[, ]*([[:alnum:]]+)?[, ]*([[:alnum:]]+)?[, ]*([[:alnum:]]+)?[, ]*([[:alnum:]]+)?[, ]*([[:alnum:]]+)?"
REGEX2="^([^#]+)#${MODES2}#"
REPL2='\1["\2", "\3", "\4", "\5", "\6", "\7"]'

echo '['
avrdude -p? 2>&1 \
 | sed -n -E "s/${REGEX1}/${REPL1}/p" \
 | sed -n -E "s/${REGEX2}/${REPL2}/p" \
 | sed -E 's/, ""//g' \
 | sed '$s/,$//'
echo "]"
