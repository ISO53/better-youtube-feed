<template>
	<div class="table-card">
		<table class="table">
			<thead>
				<tr>
					<th
						v-for="col in columns"
						:key="col.key"
						:style="col.width ? { width: col.width } : {}"
					>
						{{ col.label }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-if="rows.length === 0">
					<td :colspan="columns.length" class="empty">{{ emptyMessage }}</td>
				</tr>
				<tr v-for="(row, index) in rows" :key="row[keyField] ?? index">
					<td v-for="col in columns" :key="col.key">
						<slot :name="`cell-${col.key}`" :row="row" :index="index">
							{{ row[col.key] }}
						</slot>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script setup>
// Generic table in a raised card; per-column custom cells via #cell-<key> slots.
/** @param {{ key: string, label: string, width?: string }[]} columns */
defineProps({
	columns: { type: Array, required: true },
	rows: { type: Array, required: true },
	keyField: { type: String, default: '' },
	emptyMessage: { type: String, default: 'Nothing here yet.' },
});
</script>

<style scoped>
.table-card {
	background: var(--byf-raised);
	border-radius: 12px;
	overflow: hidden;
}

.table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
	font-size: 13px;
}

th {
	padding: 12px 16px;
	text-align: left;
	font-size: 12px;
	font-weight: 500;
	color: var(--byf-text-dim);
	text-transform: uppercase;
	letter-spacing: 0.3px;
	border-bottom: 1px solid var(--byf-border);
}

td {
	padding: 10px 16px;
	color: var(--byf-text);
	border-bottom: 1px solid var(--byf-border);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

tr:last-child td {
	border-bottom: none;
}

.empty {
	padding: 32px 16px;
	color: var(--byf-text-dim);
	text-align: center;
}
</style>
