"""Seed only local QA decks on an isolated simulator; never calls the backend."""
import argparse
import datetime
import json
import pathlib
import sqlite3
import subprocess
import tempfile

APP = 'com.aistudy.platform'
PREFIX = 'sample-deck-ui-validation-'

def run(*args, check=True):
    return subprocess.run(args, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def seed(path, cleanup):
    db = sqlite3.connect(path)
    db.execute('PRAGMA foreign_keys = ON')
    db.execute('CREATE TABLE IF NOT EXISTS preview_sets (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS preview_items (id TEXT PRIMARY KEY NOT NULL, set_id TEXT NOT NULL REFERENCES preview_sets(id) ON DELETE CASCADE, position INTEGER NOT NULL, data TEXT NOT NULL)')
    for row in db.execute('SELECT id FROM preview_sets').fetchall():
        if row[0].startswith(PREFIX):
            db.execute('DELETE FROM preview_items WHERE set_id = ?', row)
            db.execute('DELETE FROM preview_sets WHERE id = ?', row)
    if not cleanup:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        source = {'document_name': 'Local QA fixture', 'section': 'Study flow test', 'page': 1,
                  'snippet': 'Active recall retrieves knowledge from memory. Spacing separates practice sessions. This is synthetic test material.'}
        questions = [
            {'type': 'multiple_choice', 'question': 'Which activity retrieves knowledge from memory?', 'answer': 'Active recall', 'options': ['Active recall', 'Highlighting', 'Copying notes', 'Rereading']},
            {'type': 'true_false', 'question': 'Spacing separates practice sessions.', 'answer': 'True', 'options': ['True', 'False']},
            {'type': 'identification', 'question': 'Name the technique that separates practice sessions.', 'answer': 'Spacing'},
            {'type': 'fill_in_the_blank', 'question': 'Active ____ retrieves knowledge from memory.', 'answer': 'Recall'},
        ]
        flashcards = [{'type': 'flashcard', 'question': f'Practice prompt {n + 1}: what is active recall?', 'answer': 'Retrieving knowledge from memory.', 'explanation': 'Try answering before reading the notes. ' * (12 if n == 0 else 1)} for n in range(4)]
        summary = {'type': 'summary', 'question': 'Recall and spacing', 'answer': 'Active recall retrieves knowledge from memory. Spacing separates practice sessions.'}
        decks = [('mixed', 'Study flow QA', flashcards + questions + [summary], None),
                 ('timed', 'Timed quiz QA', [questions[0]], 15)]
        for suffix, title, content, timer in decks:
            identifier = PREFIX + suffix
            config = {'preview': True, 'question_types': sorted({q['type'] for q in content if q['type'] != 'summary'})}
            if timer: config['time_limit_per_question'] = timer
            study_set = {'id': identifier, 'user_id': 'local_preview', 'title': title, 'description': 'Synthetic local test material; not AI-generated content.', 'item_count': len(content), 'generation_config': config, 'created_at': now, 'updated_at': now}
            db.execute('INSERT INTO preview_sets (id, data) VALUES (?, ?)', (identifier, json.dumps(study_set)))
            for position, question in enumerate(content):
                item = {**question, 'id': f'{identifier}-{position}', 'study_set_id': identifier, 'difficulty': 'medium', 'explanation': question.get('explanation', 'Recall checks retrieval; spacing separates practice sessions.'), 'hint': 'Think about retrieving information and separating sessions.', 'source_metadata': source, 'order_index': position, 'created_at': now}
                db.execute('INSERT INTO preview_items (id, set_id, position, data) VALUES (?, ?, ?, ?)', (item['id'], identifier, position, json.dumps(item)))
    db.commit()
    db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    db.close()

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('platform', choices=['ios', 'android'])
parser.add_argument('device')
parser.add_argument('--adb', default='adb')
parser.add_argument('--cleanup', action='store_true')
args = parser.parse_args()
if args.platform == 'ios':
    run('xcrun', 'simctl', 'terminate', args.device, APP, check=False)
    container = pathlib.Path(run('xcrun', 'simctl', 'get_app_container', args.device, APP, 'data').stdout.decode().strip())
    path = container / 'Documents/SQLite/momo-onboarding.db'
    path.parent.mkdir(parents=True, exist_ok=True)
    seed(path, args.cleanup)
else:
    adb = [args.adb, '-s', args.device]
    run(*adb, 'shell', 'am', 'force-stop', APP)
    remote = 'files/SQLite/momo-onboarding.db'
    with tempfile.TemporaryDirectory(prefix='momo-qa-') as temporary:
        path = pathlib.Path(temporary) / 'momo-onboarding.db'
        for suffix in ['', '-wal']:
            result = run(*adb, 'exec-out', 'run-as', APP, 'cat', remote + suffix, check=False)
            if result.returncode == 0: pathlib.Path(str(path) + suffix).write_bytes(result.stdout)
        seed(path, args.cleanup)
        run(*adb, 'push', str(path), '/data/local/tmp/momo-qa.db')
        run(*adb, 'shell', 'run-as', APP, 'mkdir', '-p', 'files/SQLite')
        run(*adb, 'shell', 'run-as', APP, 'cp', '/data/local/tmp/momo-qa.db', remote)
        run(*adb, 'shell', 'run-as', APP, 'rm', '-f', remote + '-wal', remote + '-shm')
        run(*adb, 'shell', 'rm', '/data/local/tmp/momo-qa.db')
print('Removed QA decks.' if args.cleanup else 'Seeded mixed study and timed quiz QA decks. App is stopped; relaunch to restore them.')
