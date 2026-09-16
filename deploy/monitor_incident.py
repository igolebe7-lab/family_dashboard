"""One assigned GitHub incident per outage; no application data in public issues."""
import json
import os
import subprocess

TITLE = '[monitor] FamilyTime availability or TLS incident'


def action(healthy, has_incident):
    if healthy and has_incident:
        return 'close'
    if not healthy and not has_incident:
        return 'create'
    return 'none'


def main():
    if os.environ.get('NOTIFICATION_TEST') == 'true':
        subprocess.run(['gh', 'issue', 'create', '--title', '[TEST 14.12.2] FamilyTime notification delivery',
                        '--assignee', os.environ['OWNER'], '--body',
                        'Controlled notification test. The application is NOT reported down. '
                        'Please confirm receipt of the GitHub/email notification, then close this issue. '
                        + os.environ['RUN_URL']], check=True)
    issues = json.loads(subprocess.check_output(['gh', 'issue', 'list', '--state', 'open',
                       '--author', 'github-actions[bot]', '--limit', '100', '--json', 'number,title']))
    incident = next((i for i in issues if i['title'] == TITLE), None)
    operation = action(os.environ['HEALTH'] == 'success', incident is not None)
    if operation == 'create':
        subprocess.run(['gh', 'issue', 'create', '--title', TITLE, '--assignee', os.environ['OWNER'],
                        '--body', 'Public HTTP/TLS checks failed after retries. Inspect: ' + os.environ['RUN_URL']], check=True)
    elif operation == 'close':
        subprocess.run(['gh', 'issue', 'close', str(incident['number']), '--comment',
                        'Public HTTP/TLS checks recovered: ' + os.environ['RUN_URL']], check=True)


if __name__ == '__main__':
    main()
