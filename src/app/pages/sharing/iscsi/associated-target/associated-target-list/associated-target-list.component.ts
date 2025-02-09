import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { marker as T } from '@biesbjerg/ngx-translate-extract-marker';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import * as _ from 'lodash';
import { forkJoin } from 'rxjs';
import { filter } from 'rxjs/operators';
import { IscsiTargetExtent } from 'app/interfaces/iscsi.interface';
import { WebsocketError } from 'app/interfaces/websocket-error.interface';
import { EntityTableComponent } from 'app/pages/common/entity/entity-table/entity-table.component';
import { EntityTableAction, EntityTableConfig } from 'app/pages/common/entity/entity-table/entity-table.interface';
import { EntityUtils } from 'app/pages/common/entity/utils';
import {
  AppLoaderService, DialogService, IscsiService, WebSocketService,
} from 'app/services';

@UntilDestroy()
@Component({
  selector: 'app-iscsi-associated-target-list',
  template: `
    <entity-table [conf]="this" [title]="tableTitle"></entity-table>
  `,
  providers: [IscsiService],
})
export class AssociatedTargetListComponent implements EntityTableConfig {
  tableTitle = 'Associated Targets';
  queryCall = 'iscsi.targetextent.query' as const;
  wsDelete = 'iscsi.targetextent.delete' as const;
  route_add: string[] = ['sharing', 'iscsi', 'associatedtarget', 'add'];
  route_add_tooltip = 'Add Target/Extent';
  route_edit: string[] = ['sharing', 'iscsi', 'associatedtarget', 'edit'];

  columns = [
    {
      name: T('Target'),
      prop: 'target',
      always_display: true,
    },
    {
      name: T('LUN ID'),
      prop: 'lunid',
    },
    {
      name: T('Extent'),
      prop: 'extent',
    },
  ];
  rowIdentifier = 'target';
  config = {
    paging: true,
    sorting: { columns: this.columns },
    deleteMsg: {
      title: 'Target/Extent',
      key_props: ['target', 'extent'],
    },
  };

  protected entityList: EntityTableComponent;

  constructor(
    protected router: Router,
    protected iscsiService: IscsiService,
    private loader: AppLoaderService,
    private dialogService: DialogService,
    private ws: WebSocketService,
    private translate: TranslateService,
  ) {}

  afterInit(entityList: EntityTableComponent): void {
    this.entityList = entityList;
  }

  dataHandler(entityList: EntityTableComponent): void {
    forkJoin([
      this.iscsiService.getTargets(),
      this.iscsiService.getExtents(),
    ]).pipe(untilDestroyed(this)).subscribe(([targets, extents]) => {
      entityList.rows.forEach((row) => {
        row.target = _.find(targets, { id: row.target })['name'];
        row.extent = _.find(extents, { id: row.extent })['name'];
      });
    });
  }

  getActions(row: IscsiTargetExtent): EntityTableAction[] {
    return [{
      id: row.target,
      name: 'edit',
      icon: 'edit',
      label: T('Edit'),
      onClick: (rowinner: IscsiTargetExtent) => { this.entityList.doEdit(rowinner.id); },
    }, {
      id: row.target,
      name: 'delete',
      icon: 'delete',
      label: T('Delete'),
      onClick: (rowinner: IscsiTargetExtent) => {
        let deleteMsg = this.entityList.getDeleteMessage(rowinner);
        this.iscsiService.getGlobalSessions().pipe(untilDestroyed(this)).subscribe(
          (sessions) => {
            let warningMsg = '';
            sessions.forEach((session) => {
              if (session.target.split(':')[1] == rowinner.target) {
                warningMsg = `<font color="red">${this.translate.instant('Warning: iSCSI Target is already in use.</font><br>')}`;
              }
            });
            deleteMsg = warningMsg + deleteMsg;

            this.dialogService.confirm({
              title: T('Delete'),
              message: deleteMsg,
              buttonMsg: T('Delete'),
            }).pipe(filter(Boolean), untilDestroyed(this)).subscribe(() => {
              this.loader.open();
              this.entityList.loaderOpen = true;
              this.ws.call(this.wsDelete, [rowinner.id, true]).pipe(untilDestroyed(this)).subscribe(
                () => { this.entityList.getData(); },
                (resinner: WebsocketError) => {
                  new EntityUtils().handleError(this, resinner);
                  this.loader.close();
                },
              );
            });
          },
        );
      },
    }];
  }
}
