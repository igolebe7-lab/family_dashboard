migrate((app) => {
  const ids = {
    families: 'ft_families_001',
    familyMembers: 'ft_members_0001',
    dayAnnotations: 'ft_day_ann_001'
  };

  const authMemberRule =
    '@request.auth.id != "" && (family.owner_user = @request.auth.id || family.family_members_via_family.user ?= @request.auth.id)';

  saveCollection(app, {
    id: ids.dayAnnotations,
    type: 'base',
    name: 'day_annotations',
    listRule: authMemberRule,
    viewRule: authMemberRule,
    createRule: authMemberRule,
    updateRule: authMemberRule,
    deleteRule: authMemberRule,
    fields: [
      relation('family', ids.families, true),
      select('kind', ['birthday', 'public_holiday', 'family_date', 'observance', 'memorial'], true),
      text('title', true),
      text('description'),
      number('month', true),
      number('day', true),
      number('year'),
      select('recurrence', ['one_time', 'yearly'], true),
      select('color', ['green', 'lavender', 'blue', 'peach', 'yellow', 'danger', 'gray'], true),
      select('tone', ['positive', 'neutral', 'important', 'memorial', 'system'], true),
      select('visibility', ['private', 'assignees', 'family', 'adults'], true),
      select('source', ['manual', 'family_member', 'nager_date'], true),
      bool('readonly', false),
      relation('linked_member', ids.familyMembers, false),
      text('person_name'),
      text('person_relation'),
      text('person_contact'),
      text('country_code'),
      text('region_code'),
      text('source_uid'),
      text('source_hash'),
      date('fetched_at'),
      relation('created_by', ids.familyMembers, false)
    ],
    indexes: [
      'CREATE INDEX idx_day_annotations_family_month_day ON day_annotations (family, month, day)',
      'CREATE INDEX idx_day_annotations_family_year ON day_annotations (family, year)',
      'CREATE INDEX idx_day_annotations_linked_member ON day_annotations (linked_member)',
      'CREATE INDEX idx_day_annotations_source ON day_annotations (source, source_uid)'
    ]
  });
}, (app) => {
  const collection = app.findCollectionByNameOrId('day_annotations');
  if (collection) app.delete(collection);
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

function bool(name, defaultValue) {
  return { name, type: 'bool', required: false, presentable: false, default: defaultValue };
}

function number(name, required = false) {
  return { name, type: 'number', required };
}

function date(name, required = false) {
  return { name, type: 'date', required };
}

function autodate(name, onCreate, onUpdate) {
  return { name, type: 'autodate', onCreate, onUpdate };
}

function relation(name, collectionId, required = false, maxSelect = 1) {
  return { name, type: 'relation', required, collectionId, maxSelect };
}

function select(name, values, required) {
  return { name, type: 'select', required, values, maxSelect: 1 };
}
