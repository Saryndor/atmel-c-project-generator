#!/bin/env bash

PROG="^[[:space:]]+(\S+)[[:space:]]+= "
DESC="(.*)"
MODES1=" \((.*)\)"
# MODES2="([[:alnum:]]+)[, ]?([[:alnum:]]+)?[, ]?([[:alnum:]]+))[, ]?([[:alnum:]]+)?"

REGEX1="${PROG}${DESC}${MODES1}"
REPL1='  {"prog": "\1", "desc": "\2", "modes": #\3#},'

MODES2="([[:alnum:]]+)[, ]*([[:alnum:]]+)?[, ]*([[:alnum:]]+)?[, ]*([[:alnum:]]+)?[, ]*([[:alnum:]]+)?[, ]*([[:alnum:]]+)?[, ]*([[:alnum:]]+)?"
REGEX2="\"modes\": #${MODES2}#"
REPL2='"modes": ["\1", "\2", "\3", "\4", "\5", "\6", "\7"]'

# echo "sed -n -E \"s/${REGEX1}/${REPL1}/p\""
# echo "sed -n -E \"s/${REGEX2}/${REPL2}/p\""

echo '['
avrdude -c? 2>&1 \
 | sed -n -E "s/${REGEX1}/${REPL1}/p" \
 | sed -n -E "s/${REGEX2}/${REPL2}/p" \
 | sed -E 's/, ""//g' \
 | sed '$s/,$//' \
 | sort
echo "]"
