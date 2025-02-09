import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { marker as T } from '@biesbjerg/ngx-translate-extract-marker';
import { EntityTableConfig } from 'app/pages/common/entity/entity-table/entity-table.interface';

@Component({
  selector: 'app-iscsi-authorizedaccess-list',
  template: `
    <entity-table [conf]="this" [title]="tableTitle"></entity-table>
  `,
})
export class AuthorizedAccessListComponent implements EntityTableConfig {
  tableTitle = 'Authorized Access';
  queryCall = 'iscsi.auth.query' as const;
  wsDelete = 'iscsi.auth.delete' as const;
  route_add: string[] = ['sharing', 'iscsi', 'auth', 'add'];
  route_edit: string[] = ['sharing', 'iscsi', 'auth', 'edit'];
  route_add_tooltip = 'Add Authorized Access';

  columns = [
    {
      name: T('Group ID'),
      prop: 'tag',
      always_display: true,
    },
    {
      name: T('User'),
      prop: 'user',
    },
    {
      name: T('Peer User'),
      prop: 'peeruser',
    },
  ];
  rowIdentifier = 'tag';
  config = {
    paging: true,
    sorting: { columns: this.columns },
    deleteMsg: {
      title: 'Authorized Access',
      key_props: ['tag'],
    },
  };

  constructor(protected router: Router) {}
}
