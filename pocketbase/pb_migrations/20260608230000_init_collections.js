migrate((app) => {
  const ids = {
    families: 'ft_families_001',
    familyMembers: 'ft_members_0001',
    items: 'ft_items_000001',
    occurrences: 'ft_occurs_00001',
    comments: 'ft_comments_001',
    activity: 'ft_activity_001',
    notifications: 'ft_notices_0001',
    invitations: 'ft_invites_0001'
  };

  const users = '_pb_users_auth_';
  const familyOwnerRule = '@request.auth.id != "" && owner_user = @request.auth.id';
  const familyMemberRule =
    '@request.auth.id != "" && (owner_user = @request.auth.id || family_members_via_family.user ?= @request.auth.id)';
  const authMemberRule =
    '@request.auth.id != "" && (family.owner_user = @request.auth.id || family.family_members_via_family.user ?= @request.auth.id)';
  const visibleToRule = '@request.auth.id != "" && visible_to.user ?= @request.auth.id';

  saveCollection(app, {
    id: ids.families,
    type: 'base',
    name: 'families',
    listRule: familyOwnerRule,
    viewRule: familyOwnerRule,
    createRule: '@request.auth.id != ""',
    updateRule: familyOwnerRule,
    deleteRule: familyOwnerRule,
    fields: [
      text('name', true),
      text('slug', true),
      relation('owner_user', users, true),
      text('timezone', true),
      json('theme_json'),
      json('settings_json')
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_families_slug ON families (slug)',
      'CREATE INDEX idx_families_owner_user ON families (owner_user)'
    ]
  });

  saveCollection(app, {
    id: ids.familyMembers,
    type: 'base',
    name: 'family_members',
    listRule: authMemberRule,
    viewRule: authMemberRule,
    createRule: '@request.auth.id != "" && family.owner_user = @request.auth.id',
    updateRule: '@request.auth.id != "" && family.owner_user = @request.auth.id',
    deleteRule: '@request.auth.id != "" && family.owner_user = @request.auth.id',
    fields: [
      relation('family', ids.families, true),
      relation('user', users, false),
      text('display_name', true),
      select('role', ['owner', 'parent', 'adult', 'teen', 'child', 'guest'], true),
      file('avatar'),
      select('color_key', ['lavender', 'blue', 'green', 'peach', 'yellow'], false),
      text('color_hex'),
      date('birthday'),
      bool('is_child_login_enabled', false),
      json('notification_settings_json'),
      bool('active', true)
    ],
    indexes: [
      'CREATE INDEX idx_family_members_family ON family_members (family)',
      'CREATE INDEX idx_family_members_user ON family_members (user)',
      'CREATE INDEX idx_family_members_family_user ON family_members (family, user)'
    ]
  });

  const familyMembers = app.findCollectionByNameOrId(ids.familyMembers);
  familyMembers.fields.addMarshaledJSON(
    JSON.stringify([
      relation('managed_by', ids.familyMembers, false, 10),
      relation('created_by', ids.familyMembers, false)
    ])
  );
  app.save(familyMembers);

  const families = app.findCollectionByNameOrId(ids.families);
  families.listRule = familyMemberRule;
  families.viewRule = familyMemberRule;
  app.save(families);

  saveCollection(app, {
    id: ids.items,
    type: 'base',
    name: 'items',
    listRule: visibleToRule,
    viewRule: visibleToRule,
    createRule: '@request.auth.id != ""',
    updateRule: visibleToRule,
    deleteRule: visibleToRule,
    fields: [
      relation('family', ids.families, true),
      select('kind', ['event', 'task', 'assignment', 'routine'], true),
      text('title', true),
      text('description'),
      relation('created_by', ids.familyMembers, true),
      relation('owner', ids.familyMembers, false),
      relation('assignees', ids.familyMembers, false, 20),
      relation('participants', ids.familyMembers, false, 20),
      relation('visible_to', ids.familyMembers, false, 50),
      select('category', [
        'family',
        'home',
        'school',
        'sport',
        'health',
        'shopping',
        'work',
        'money',
        'travel',
        'other'
      ], true),
      select('priority', ['low', 'normal', 'high', 'urgent'], true),
      select('visibility', ['private', 'assignees', 'family', 'adults'], true),
      bool('all_day', false),
      date('start_at'),
      date('end_at'),
      date('due_at'),
      text('timezone', true),
      text('recurrence_rule'),
      date('recurrence_until'),
      json('recurrence_exdates_json'),
      number('reminder_offset_minutes'),
      bool('approval_required', false),
      json('checklist_json'),
      number('points'),
      text('location_text'),
      text('color_override'),
      file('attachments', 10),
      bool('archived', false)
    ],
    indexes: [
      'CREATE INDEX idx_items_family ON items (family)',
      'CREATE INDEX idx_items_kind ON items (kind)',
      'CREATE INDEX idx_items_created_by ON items (created_by)',
      'CREATE INDEX idx_items_owner ON items (owner)',
      'CREATE INDEX idx_items_start_at ON items (start_at)',
      'CREATE INDEX idx_items_due_at ON items (due_at)',
      'CREATE INDEX idx_items_updated ON items (updated)'
    ]
  });

  saveCollection(app, {
    id: ids.occurrences,
    type: 'base',
    name: 'item_occurrences',
    listRule: visibleToRule,
    viewRule: visibleToRule,
    createRule: '@request.auth.id != ""',
    updateRule: visibleToRule,
    deleteRule: visibleToRule,
    fields: [
      relation('family', ids.families, true),
      relation('item', ids.items, true),
      relation('visible_to', ids.familyMembers, false, 50),
      select('kind', ['event', 'task', 'assignment', 'routine'], true),
      text('title_snapshot', true),
      select('category_snapshot', [
        'family',
        'home',
        'school',
        'sport',
        'health',
        'shopping',
        'work',
        'money',
        'travel',
        'other'
      ], true),
      date('start_at'),
      date('end_at'),
      date('due_at'),
      bool('all_day', false),
      select('status', [
        'todo',
        'assigned',
        'accepted',
        'in_progress',
        'done',
        'approved',
        'rejected',
        'skipped',
        'overdue',
        'cancelled'
      ], true),
      relation('completed_by', ids.familyMembers, false),
      date('completed_at'),
      relation('approved_by', ids.familyMembers, false),
      date('approved_at'),
      relation('rejected_by', ids.familyMembers, false),
      date('rejected_at'),
      text('rejection_reason'),
      relation('skipped_by', ids.familyMembers, false),
      text('skipped_reason'),
      json('override_json')
    ],
    indexes: [
      'CREATE INDEX idx_occurrences_family_start ON item_occurrences (family, start_at)',
      'CREATE INDEX idx_occurrences_family_due ON item_occurrences (family, due_at)',
      'CREATE INDEX idx_occurrences_family_status ON item_occurrences (family, status)',
      'CREATE INDEX idx_occurrences_item ON item_occurrences (item)'
    ]
  });

  saveCollection(app, {
    id: ids.comments,
    type: 'base',
    name: 'item_comments',
    listRule: authMemberRule,
    viewRule: authMemberRule,
    createRule: authMemberRule,
    updateRule: authMemberRule,
    deleteRule: authMemberRule,
    fields: [
      relation('family', ids.families, true),
      relation('item', ids.items, true),
      relation('occurrence', ids.occurrences, false),
      relation('author', ids.familyMembers, true),
      text('text'),
      text('emoji'),
      file('attachments', 10)
    ],
    indexes: ['CREATE INDEX idx_item_comments_family ON item_comments (family)']
  });

  saveCollection(app, {
    id: ids.activity,
    type: 'base',
    name: 'item_activity',
    listRule: authMemberRule,
    viewRule: authMemberRule,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      relation('family', ids.families, true),
      relation('item', ids.items, false),
      relation('occurrence', ids.occurrences, false),
      relation('actor', ids.familyMembers, true),
      select('action', [
        'item.created',
        'item.updated',
        'item.deleted',
        'occurrence.created',
        'occurrence.rescheduled',
        'assignment.assigned',
        'assignment.accepted',
        'assignment.done',
        'assignment.approved',
        'assignment.rejected',
        'assignment.skipped',
        'comment.created',
        'member.created',
        'member.updated'
      ], true),
      text('summary', true),
      json('old_value_json'),
      json('new_value_json')
    ],
    indexes: ['CREATE INDEX idx_item_activity_family ON item_activity (family)']
  });

  saveCollection(app, {
    id: ids.notifications,
    type: 'base',
    name: 'notifications',
    listRule: '@request.auth.id != "" && recipient_user = @request.auth.id',
    viewRule: '@request.auth.id != "" && recipient_user = @request.auth.id',
    createRule: null,
    updateRule: '@request.auth.id != "" && recipient_user = @request.auth.id',
    deleteRule: null,
    fields: [
      relation('family', ids.families, true),
      relation('recipient_member', ids.familyMembers, true),
      relation('recipient_user', users, false),
      select('type', [
        'assignment.created',
        'assignment.due_soon',
        'assignment.done_waiting_approval',
        'assignment.approved',
        'assignment.rejected',
        'event.reminder',
        'event.changed',
        'comment.created',
        'digest.morning',
        'digest.evening'
      ], true),
      text('title', true),
      text('body', true),
      relation('item', ids.items, false),
      relation('occurrence', ids.occurrences, false),
      date('read_at'),
      date('delivered_at')
    ],
    indexes: ['CREATE INDEX idx_notifications_recipient ON notifications (recipient_member, read_at)']
  });

  saveCollection(app, {
    id: ids.invitations,
    type: 'base',
    name: 'invitations',
    listRule: authMemberRule,
    viewRule: authMemberRule,
    createRule: '@request.auth.id != "" && family.owner_user = @request.auth.id',
    updateRule: '@request.auth.id != "" && family.owner_user = @request.auth.id',
    deleteRule: '@request.auth.id != "" && family.owner_user = @request.auth.id',
    fields: [
      relation('family', ids.families, true),
      text('code', true),
      select('role', ['parent', 'adult', 'teen', 'child', 'guest'], true),
      email('email'),
      relation('created_by', ids.familyMembers, true),
      date('expires_at', true),
      relation('used_by_user', users, false),
      date('used_at'),
      date('revoked_at')
    ],
    indexes: ['CREATE UNIQUE INDEX idx_invitations_code ON invitations (code)']
  });
}, (app) => {
  [
    'invitations',
    'notifications',
    'item_activity',
    'item_comments',
    'item_occurrences',
    'items',
    'family_members',
    'families'
  ].forEach((name) => {
    const collection = app.findCollectionByNameOrId(name);
    if (collection) app.delete(collection);
  });
});

function saveCollection(app, config) {
  if (config.type === 'base') {
    config.fields = withAutodates(config.fields);
  }
  const collection = new Collection(config);
  app.save(collection);
}

function withAutodates(fields) {
  const names = new Set(fields.map((field) => field.name));
  const nextFields = [...fields];

  if (!names.has('created')) {
    nextFields.push(autodate('created', true, false));
  }

  if (!names.has('updated')) {
    nextFields.push(autodate('updated', true, true));
  }

  return nextFields;
}

function text(name, required = false) {
  return { name, type: 'text', required };
}

function email(name) {
  return { name, type: 'email' };
}

function bool(name, defaultValue) {
  return { name, type: 'bool', required: false, presentable: false };
}

function number(name) {
  return { name, type: 'number' };
}

function date(name, required = false) {
  return { name, type: 'date', required };
}

function autodate(name, onCreate, onUpdate) {
  return { name, type: 'autodate', onCreate, onUpdate };
}

function json(name) {
  return { name, type: 'json' };
}

function file(name, maxSelect = 1) {
  return { name, type: 'file', maxSelect };
}

function relation(name, collectionId, required = false, maxSelect = 1) {
  return { name, type: 'relation', required, collectionId, maxSelect };
}

function select(name, values, required) {
  return { name, type: 'select', required, values, maxSelect: 1 };
}
