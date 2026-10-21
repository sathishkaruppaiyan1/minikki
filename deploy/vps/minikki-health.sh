#!/bin/bash
# minikki health monitor, runs every minute (minikki-functions-watchdog.timer).
# Self-heals what we own (functions, PostgREST, Postgres); only alerts for
# CloudPanel-managed pieces (nginx, PHP, MySQL/WordPress) so it never touches them.
# Alerts go to the journal (journalctl -t minikki-health) and, if ALERT_EMAIL is
# set in /etc/minikki-health.conf, by email, at most once per issue per hour.
ALERT_EMAIL=""
[ -f /etc/minikki-health.conf ] && . /etc/minikki-health.conf
mkdir -p /var/lib/minikki-health

alert() { # $1=key $2=message
  logger -t minikki-health "ALERT $1: $2"
  local f="/var/lib/minikki-health/$1"
  [ -f "$f" ] && [ $(( $(date +%s) - $(stat -c %Y "$f") )) -lt 3600 ] && return
  touch "$f"
  [ -n "$ALERT_EMAIL" ] && printf "%s\n\nHost: %s\nTime: %s\n" "$2" "$(hostname)" "$(date)" | mail -s "[minikki] $1" "$ALERT_EMAIL"
}
ok() {
  if [ -f "/var/lib/minikki-health/$1" ]; then
    rm -f "/var/lib/minikki-health/$1"
    logger -t minikki-health "RECOVERED $1"
  fi
  return 0
}
code() { curl -s -o /dev/null -m 10 -w "%{http_code}" "$@"; }
# True when the URL fails twice in a row (no response or 5xx), 5s apart.
retry_fail() {
  local c; c=$(code "$@")
  [ "$c" != "000" ] && [ "${c:0:1}" != "5" ] && return 1
  sleep 5; c=$(code "$@")
  [ "$c" = "000" ] || [ "${c:0:1}" = "5" ]
}

# Functions API (what minikki.in calls for products/banners/orders)
if retry_fail http://127.0.0.1:8000/functions/v1/home-banners; then
  systemctl restart minikki-functions
  alert functions-down "Functions API was not responding; restarted minikki-functions."
else ok functions-down; fi

# Early warning well before the 2G memory limit
mem=$(systemctl show minikki-functions -p MemoryCurrent --value)
if [[ "$mem" =~ ^[0-9]+$ ]] && [ "$mem" -gt 1610612736 ]; then
  systemctl restart minikki-functions
  alert functions-memory "minikki-functions used $((mem/1048576)) MB (limit 2048); restarted it. Something is leaking memory again."
else ok functions-memory; fi

# PostgREST
if retry_fail http://127.0.0.1:3000/; then
  systemctl restart minikki-postgrest
  alert postgrest-down "PostgREST was not responding; restarted it."
else ok postgrest-down; fi

# Postgres
if ! sudo -u postgres pg_isready -q -t 5; then
  systemctl restart postgresql
  alert postgres-down "Postgres was not accepting connections; restarted it."
else ok postgres-down; fi

# WordPress / WooCommerce API (CloudPanel-managed: alert only)
if retry_fail -k --resolve adminminikki.tech:443:127.0.0.1 https://adminminikki.tech/wp-json/minikki/v1/home; then
  alert wordpress-down "adminminikki.tech wp-json is failing (PHP-FPM/MySQL/nginx). Not restarted automatically."
else ok wordpress-down; fi

# Storefront (CloudPanel-managed: alert only)
if retry_fail -k --resolve www.minikki.in:443:127.0.0.1 https://www.minikki.in/; then
  alert site-down "www.minikki.in is not being served by nginx."
else ok site-down; fi

# Disk and swap
disk=$(df --output=pcent / | tail -1 | tr -dc 0-9)
if [ "$disk" -ge 85 ]; then alert disk-full "Root disk is ${disk}% full."; else ok disk-full; fi
swap=$(free -m | awk '/Swap/{print $3}')
if [ "$swap" -ge 1024 ]; then alert swap-high "${swap} MB of swap in use; something is short of memory."; else ok swap-high; fi
exit 0
