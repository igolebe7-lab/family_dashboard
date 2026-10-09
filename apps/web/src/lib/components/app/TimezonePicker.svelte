<script lang="ts">
  import { DEFAULT_TIMEZONE } from '$lib/utils/timezone';
  export let value = DEFAULT_TIMEZONE;
  const common: Record<string, string> = {
    'Europe/Moscow': 'Москва', 'Europe/Kaliningrad': 'Калининград', 'Europe/Samara': 'Самара',
    'Asia/Yekaterinburg': 'Екатеринбург', 'Asia/Omsk': 'Омск', 'Asia/Krasnoyarsk': 'Красноярск',
    'Asia/Irkutsk': 'Иркутск', 'Asia/Yakutsk': 'Якутск', 'Asia/Vladivostok': 'Владивосток',
    'Asia/Magadan': 'Магадан', 'Asia/Kamchatka': 'Камчатка', 'UTC': 'UTC'
  };
  const zones = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone')
    ?? ['Europe/Amsterdam', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Tokyo'];
  $: other = [...new Set([...zones, value])].filter(zone => !common[zone]).sort();
</script>

<label>
  <span>Часовой пояс</span>
  <select bind:value aria-label="Часовой пояс">
    <optgroup label="Россия и UTC">
      {#each Object.entries(common) as [zone, label]}<option value={zone}>{label} · {zone}</option>{/each}
    </optgroup>
    <optgroup label="Другие часовые пояса">
      {#each other as zone}<option value={zone}>{zone.replaceAll('_', ' ')}</option>{/each}
    </optgroup>
  </select>
</label>
