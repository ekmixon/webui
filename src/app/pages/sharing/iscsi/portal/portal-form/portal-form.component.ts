import { Component } from '@angular/core';
import { Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as _ from 'lodash';
import { helptext_sharing_iscsi } from 'app/helptext/sharing';
import { FormConfiguration } from 'app/interfaces/entity-form.interface';
import { IscsiInterface, IscsiPortal } from 'app/interfaces/iscsi.interface';
import { Option } from 'app/interfaces/option.interface';
import { EntityFormComponent } from 'app/pages/common/entity/entity-form/entity-form.component';
import { FieldConfig, FormListConfig, FormSelectConfig } from 'app/pages/common/entity/entity-form/models/field-config.interface';
import { FieldSet } from 'app/pages/common/entity/entity-form/models/fieldset.interface';
import { selectedOptionValidator } from 'app/pages/common/entity/entity-form/validators/invalid-option-selected';
import { ipValidator } from 'app/pages/common/entity/entity-form/validators/ip-validation';
import { EntityUtils } from 'app/pages/common/entity/utils';
import { IscsiService, WebSocketService, AppLoaderService } from 'app/services';

interface PortalListen {
  ip: string[];
  port: string;
}

interface PortalAddress {
  ip: string;
  port: string;
}

@UntilDestroy()
@Component({
  selector: 'app-iscsi-portal-add',
  template: '<entity-form [conf]="this"></entity-form>',
  providers: [IscsiService],
})
export class PortalFormComponent implements FormConfiguration {
  addCall = 'iscsi.portal.create' as const;
  queryCall = 'iscsi.portal.query' as const;
  editCall = 'iscsi.portal.update' as const;
  route_success: string[] = ['sharing', 'iscsi', 'portals'];
  customFilter: any[] = [[['id', '=']]];
  isEntity = true;

  protected getValidOptions = this.iscsiService.getIpChoices().toPromise().then((ips) => {
    const options: Option[] = [];
    for (const ip in ips) {
      options.push({ label: ips[ip], value: ip });
    }
    return options;
  });
  fieldSets: FieldSet[] = [
    {
      name: helptext_sharing_iscsi.fieldset_portal_basic,
      label: true,
      class: 'basic',
      width: '100%',
      config: [
        {
          type: 'input',
          name: 'comment',
          placeholder: helptext_sharing_iscsi.portal_form_placeholder_comment,
          tooltip: helptext_sharing_iscsi.portal_form_tooltip_comment,
        },
      ],
    },
    {
      name: helptext_sharing_iscsi.fieldset_portal_authgroup,
      label: true,
      class: 'authgroup',
      width: '100%',
      config: [
        {
          type: 'select',
          name: 'discovery_authmethod',
          placeholder: helptext_sharing_iscsi.portal_form_placeholder_discovery_authmethod,
          tooltip: helptext_sharing_iscsi.portal_form_tooltip_discovery_authmethod,
          options: [
            {
              label: 'NONE',
              value: 'NONE',
            },
            {
              label: 'CHAP',
              value: 'CHAP',
            },
            {
              label: 'Mutual CHAP',
              value: 'CHAP_MUTUAL',
            },
          ],
          value: 'NONE',
        },
        {
          type: 'select',
          name: 'discovery_authgroup',
          placeholder: helptext_sharing_iscsi.portal_form_placeholder_discovery_authgroup,
          tooltip: helptext_sharing_iscsi.portal_form_tooltip_discovery_authgroup,
          options: [{ label: '---', value: null }],
          value: null,
        },
      ],
    },
    {
      name: helptext_sharing_iscsi.fieldset_portal_ip,
      label: true,
      class: 'ip',
      width: '100%',
      config: [
        {
          type: 'list',
          name: 'listen',
          templateListField: [
            {
              type: 'select',
              multiple: true,
              name: 'ip',
              placeholder: helptext_sharing_iscsi.portal_form_placeholder_ip,
              tooltip: helptext_sharing_iscsi.portal_form_tooltip_ip,
              options: [],
              class: 'inline',
              width: '60%',
              required: true,
              validation: [Validators.required, ipValidator('all')],
              asyncValidation: [selectedOptionValidator(this.getValidOptions)],
            },
            {
              type: 'input',
              name: 'port',
              placeholder: helptext_sharing_iscsi.portal_form_placeholder_port,
              tooltip: helptext_sharing_iscsi.portal_form_tooltip_port,
              value: '3260',
              validation: helptext_sharing_iscsi.portal_form_validators_port,
              class: 'inline',
              width: '30%',
            },
          ],
          listFields: [],
        },
      ],
    },
  ];

  fieldConfig: FieldConfig[];
  pk: number;
  protected authgroup_field: FormSelectConfig;
  protected entityForm: EntityFormComponent;
  protected ip: PortalAddress[];

  constructor(protected router: Router,
    protected iscsiService: IscsiService,
    protected aroute: ActivatedRoute,
    protected loader: AppLoaderService,
    protected ws: WebSocketService) { }

  prerequisite(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const listenIpFieldConfig = _.find(this.fieldSets[2].config, { name: 'listen' }) as FormListConfig;
      const listenIpField = listenIpFieldConfig.templateListField[0] as FormSelectConfig;
      await this.iscsiService.getIpChoices().toPromise().then((ips) => {
        for (const ip in ips) {
          listenIpField.options.push({ label: ips[ip], value: ip });
        }
        const listenListFields = listenIpFieldConfig.listFields;
        for (const listenField of listenListFields) {
          const ipField = _.find(listenField, { name: 'ip' }) as FormSelectConfig;
          ipField.options = listenIpField.options;
        }
        resolve(true);
      }, () => {
        resolve(false);
      });
    });
  }

  preInit(): void {
    this.aroute.params.pipe(untilDestroyed(this)).subscribe((params) => {
      if (params['pk']) {
        this.pk = params['pk'];
        this.customFilter[0][0].push(parseInt(params['pk'], 10));
      }
    });
    const authgroupFieldset = _.find(this.fieldSets, { class: 'authgroup' });
    this.authgroup_field = _.find(authgroupFieldset.config, { name: 'discovery_authgroup' }) as FormSelectConfig;
    this.iscsiService.getAuth().pipe(untilDestroyed(this)).subscribe((accessRecords) => {
      accessRecords.forEach((record) => {
        if (_.find(this.authgroup_field.options, { value: record.tag }) == undefined) {
          this.authgroup_field.options.push({ label: String(record.tag), value: record.tag });
        }
      });
    });
  }

  afterInit(entityForm: EntityFormComponent): void {
    this.entityForm = entityForm;
    this.fieldConfig = entityForm.fieldConfig;

    entityForm.formGroup.controls['listen'].valueChanges.pipe(untilDestroyed(this)).subscribe((res: PortalListen[]) => {
      this.genPortalAddress(res);
    });
  }

  customEditCall(value: any): void {
    this.loader.open();
    this.ws.call(this.editCall, [this.pk, value]).pipe(untilDestroyed(this)).subscribe(
      () => {
        this.loader.close();
        this.router.navigate(new Array('/').concat(this.route_success));
      },
      (res) => {
        this.loader.close();
        new EntityUtils().handleWSError(this.entityForm, res);
      },
    );
  }

  genPortalAddress(data: PortalListen[]): void {
    let ips: PortalAddress[] = [];
    data.forEach((portal) => {
      if (portal['ip']) {
        const samePortIps = portal['ip'].reduce(
          (fullIps: PortalAddress[], currip: string) => fullIps.concat({ ip: currip, port: portal['port'] }),
          [],
        );
        ips = ips.concat(samePortIps);
      }
    });
    this.ip = ips;
  }

  beforeSubmit(data: any): void {
    data['listen'] = this.ip;
  }

  resourceTransformIncomingRestData(data: IscsiPortal): any {
    const ports = new Map() as any;
    const groupedIp: IscsiInterface[] = [];
    data.listen.forEach((listen) => {
      // TODO: Incorrect usage of map. Update to .get
      if (ports[listen.port] === undefined) {
        ports[listen.port] = [];
        groupedIp.push({
          ip: ports[listen.port],
          port: listen.port,
        });
      }
      ports[listen.port].push(listen['ip']);
    });
    return {
      ...data,
      listen: groupedIp,
    };
  }
}
