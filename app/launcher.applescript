-- Runs the weekly update (started by launchd). Messages come from WhatsApp Web, so no
-- Full Disk Access is needed anymore.
on run
	do shell script "/bin/zsh /Users/tomas/projects/whatsappTrendBot/scripts/run_weekly.sh >> /Users/tomas/projects/whatsappTrendBot/logs/launcher.log 2>&1"
end run
