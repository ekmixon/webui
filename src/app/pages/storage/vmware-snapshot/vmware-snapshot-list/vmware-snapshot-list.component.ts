import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { marker as T } from '@biesbjerg/ngx-translate-extract-marker';
import { VmwareSnapshot } from 'app/interfaces/vmware.interface';
import { EntityTableComponent } from 'app/pages/common/entity/entity-table/entity-table.component';
import { EntityTableAction, EntityTableConfig } from 'app/pages/common/entity/entity-table/entity-table.interface';

@Component({
  selector: 'vmware-snapshot-list',
  template: '<entity-table [title]="title" [conf]="this"></entity-table>',
})
export class VmwareSnapshotListComponent implements EntityTableConfig {
  title = 'VMware Snapshots';
  queryCall = 'vmware.query' as const;
  route_add: string[] = ['storage', 'vmware-snapshots', 'add'];
  route_add_tooltip = 'Add VMware Snapshot';
  protected entityList: EntityTableComponent;
  wsDelete = 'vmware.delete' as const;

  columns = [
    { name: 'Hostname', prop: 'hostname', always_display: true }, { name: 'Username', prop: 'username' },
    { name: 'filesystem', prop: 'filesystem' }, { name: 'datastore', prop: 'datastore' },
  ];
  rowIdentifier = 'hostname';
  config = {
    paging: true,
    sorting: { columns: this.columns },
    deleteMsg: {
      title: 'VMware Snapshot',
      key_props: ['hostname', 'filesystem'],
    },
  };

  constructor(private router: Router) {}

  isActionVisible(actionId: string): boolean {
    if (actionId == 'edit' || actionId == 'add') {
      return false;
    }
    return true;
  }

  getActions(row: VmwareSnapshot): EntityTableAction[] {
    return [
      {
        id: row.hostname,
        icon: 'delete',
        name: 'delete',
        label: T('Delete'),
        onClick: (row: VmwareSnapshot) => {
          this.entityList.doDelete(row);
        },
      },
      {
        id: row.hostname,
        icon: 'edit',
        name: 'edit',
        label: T('Edit'),
        onClick: (row: VmwareSnapshot) => {
          this.router.navigate(['/', 'storage', 'vmware-snapshots', 'edit', row.id]);
        },
      },
    ] as EntityTableAction[];
  }

  afterInit(entityList: EntityTableComponent): void {
    this.entityList = entityList;
  }
}
