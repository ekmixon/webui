import { Component, OnInit, AfterViewInit, ViewChild,OnDestroy } from '@angular/core';
import { CoreService, CoreEvent } from 'app/core/services/core.service';
import { SystemProfiler } from 'app/core/classes/system-profiler';

import { Subject } from 'rxjs';
import { WidgetComponent } from 'app/core/components/widgets/widget/widget.component'; // POC
import { WidgetControllerComponent } from 'app/core/components/widgets/widgetcontroller/widgetcontroller.component'; // POC
import { WidgetPoolComponent } from 'app/core/components/widgets/widgetpool/widgetpool.component';
import { FlexLayoutModule, MediaObserver } from '@angular/flex-layout';

import { RestService,WebSocketService } from '../../services/';
import { DashConfigItem } from 'app/core/components/widgets/widgetcontroller/widgetcontroller.component';

/*export interface DashConfig {
  displayList: DashConfigItem[];
}*/

@Component({
  selector: 'dashboard',
  templateUrl:'./dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  //@ViewChild('launcher', {static: true}) widgetLauncher: WidgetControllerComponent;
  public screenType: string = 'Desktop'; // Desktop || Mobile

  public dashState: DashConfigItem[]; // Saved State
  public activeMobileWidget: DashConfigItem[] = [];
  public availableWidgets: DashConfigItem[] = [];
  public renderedWidgets: number[] = [];
  public hiddenWidgets: number[] = []; 

  public large: string = "lg";
  public medium: string = "md";
  public small: string = "sm";
  public zPoolFlex:string = "100";
  public noteFlex:string = "23";

  public statsDataEvents:Subject<CoreEvent>;
  private statsEvents: any;
  private statsEventsTC: any;
  public tcStats: any;

  public isFooterConsoleOpen: boolean;

  // For CPU widget
  public systemInformation: any;

  // For widgetpool
  public system: any;
  public system_product: string = "Generic";
  public pools: any[]; // = [];
  public volumeData:any; //= {};

  public nics: any[]; // = [];

  public animation = "stop";
  public shake = false;

  public showSpinner: boolean = true;

  constructor(protected core:CoreService, protected ws: WebSocketService, public mediaObserver: MediaObserver){
    this.statsDataEvents = new Subject<CoreEvent>();

    mediaObserver.media$.subscribe((evt) =>{

      let st = evt.mqAlias == 'xs' ? 'Mobile' : 'Desktop';
      this.screenType = st;
      
    });

  }

  ngAfterViewInit(){
  }

  onMobileLaunch(evt: DashConfigItem) {
    this.activeMobileWidget = [evt];
  }

  onMobileBack() {
    this.activeMobileWidget = [];
  }

  ngOnInit(){

    this.init();

    this.ws.call('system.advanced.config').subscribe((res)=> {
      if (res) {
        this.isFooterConsoleOpen = res.consolemsg;
      }
    });

  }

  ngOnDestroy(){
    this.statsEvents.complete();
    this.statsEventsTC.complete();
    this.statsDataEvents.complete();
    this.core.unregister({observerClass:this});
  }

  init(){

    this.statsEvents = this.ws.sub("reporting.realtime").subscribe((evt)=>{
      if(evt.cpu){
        this.statsDataEvents.next({name:"CpuStats", data:evt.cpu});
      }
      if(evt.virtual_memory){
        this.statsDataEvents.next({name:"MemoryStats", data:evt.virtual_memory});
      }
    });

    this.statsEventsTC = this.ws.sub("trueview.stats:10").subscribe((evt)=>{
      if(evt.virtual_memory){return;}// TC and MW subscriptions leak into each other.
        
      evt.network_usage.forEach((item, index) => {
        this.statsDataEvents.next({name:"NetTraffic_" + item.name, data:item});
      });
    });

    this.core.register({observerClass:this,eventName:"NicInfo"}).subscribe((evt:CoreEvent) => {
      let clone = Object.assign([],evt.data);
      let removeNics = {};

      // Store keys for fast lookup
      let nicKeys = {};
      evt.data.forEach((item, index) => {
        nicKeys[item.name] = index.toString();
      });
        
      // Process Vlans (attach vlans to their parent)
      evt.data.forEach((item, index) => {
        if(item.type !== "VLAN" && !clone[index].state.vlans){
          clone[index].state.vlans = [];
        }

        if(item.type == "VLAN"){
          let parentIndex = parseInt(nicKeys[item.state.parent]);
          if(!clone[parentIndex].state.vlans) {
            clone[parentIndex].state.vlans = [];
          }

          clone[parentIndex].state.vlans.push(item.state);
          removeNics[item.name] = index;
        }
      })

      // Process LAGGs
      evt.data.forEach((item, index) => {
        if(item.type == "LINK_AGGREGATION" ){
          clone[index].state.lagg_ports = item.lag_ports;
          item.lag_ports.forEach((nic) => {
            // Consolidate addresses 
            clone[index].state.aliases.forEach((item) => { item.interface = nic});
            clone[index].state.aliases = clone[index].state.aliases.concat(clone[nicKeys[nic]].state.aliases);

            // Consolidate vlans
            clone[index].state.vlans.forEach((item) => { item.interface = nic});
            clone[index].state.vlans = clone[index].state.vlans.concat(clone[nicKeys[nic]].state.vlans);
            
            // Mark interface for removal
            removeNics[nic] = nicKeys[nic];
          });
        }
      });

      // Remove NICs from list
      for(let i = clone.length - 1; i >= 0; i--){
        if(removeNics[clone[i].name]){ 
          // Remove
          clone.splice(i, 1)
        } else {
          // Only keep INET addresses
          clone[i].state.aliases = clone[i].state.aliases.filter(address => address.type == "INET");
        }
      }
      
      // Update NICs array
      this.nics = clone;

      this.isDataReady();
    });

    this.core.emit({name:"VolumeDataRequest"});
    this.core.emit({name:"NicInfoRequest"});
    this.getDisksData();
  }

  setVolumeData(evt:CoreEvent){
    let vd = {};

    for(let i in evt.data){
      let avail = null;
      if (evt.data[i].children && evt.data[i].children[0]) {
        avail = evt.data[i].children[0].avail;
      }
      let zvol = {
        avail: avail,
        id:evt.data[i].id,
        is_decrypted:evt.data[i].is_decrypted,
        is_upgraded:evt.data[i].is_upgraded,
        mountpoint:evt.data[i].mountpoint,
        name:evt.data[i].name,
        status:evt.data[i].status, // RETURNS HEALTHY, LOCKED, UNKNOWN, DEGRADED, FAULTED, OFFLINE, REMOVED
        used:evt.data[i].used,
        used_pct:evt.data[i].used_pct,
        vol_encrypt:evt.data[i].vol_encrypted,
        vol_encryptkey:evt.data[i].vol_encryptkey,
        vol_guid:evt.data[i].vol_guid,
        vol_name:evt.data[i].vol_name
      }
      vd[zvol.id] = zvol;
    }
    
    this.volumeData = vd;
  }

  getDisksData(){

    this.core.register({observerClass: this, eventName: 'PoolData'}).subscribe((evt:CoreEvent) => {
      //this.system.pools = evt.data;
      this.pools = evt.data;
      this.isDataReady();
    });

    this.core.register({observerClass: this, eventName: 'VolumeData'}).subscribe((evt:CoreEvent) => {
      this.setVolumeData(evt);
      this.isDataReady();
    });

    this.core.register({observerClass: this, eventName: 'SysInfo'}).subscribe((evt:CoreEvent) => {
      this.systemInformation = evt.data;
      this.core.emit({name: 'PoolDataRequest', sender: this});
    });

    this.core.emit({name: 'SysInfoRequest', sender: this});
  }

  isDataReady(){
    const isReady = this.statsDataEvents && this.pools && this.volumeData && this.nics ? true : false;
    if(isReady){
      this.availableWidgets = this.generateDefaultConfig();
      if(!this.dashState){
        this.dashState = this.availableWidgets;
      }

      //this.generateRenderedList();
    }
  }

  generateRenderedList(){
    /*this.renderedWidgets = this.availableWidgets.forEach((item, index) => { 
      if(item.identifier){
        let spl = item.identifier.split(',');
        let key = spl[0];
        let value = spl[1];
      }
      
    });*/
  }

  generateDefaultConfig(){
    let conf: DashConfigItem[] = [
      {name:'System Information', rendered: true },
      {name:'CPU', rendered: true },
      {name:'Memory', rendered: true },
    ];

    this.pools.forEach((pool, index) => {
      conf.push({name:'Pool', identifier: 'name,' + pool.name, rendered: true })
    });

    this.nics.forEach((nic, index) => {
      conf.push({name:'Interface', identifier: 'name,' + nic.name, rendered: true })
    });

    return conf;
  }

  volumeDataFromConfig(item:DashConfigItem){
    const spl = item.identifier.split(',');
    const key = spl[0];
    const value = spl[1];
    
    const pool = this.pools.filter(pool => pool[key] == value);
    return this.volumeData ? this.volumeData[pool[0].id] : console.warn('No volume data available!');; 
  }

  dataFromConfig(item:DashConfigItem){
    let spl;
    let key;
    let value;
    if(item.identifier){
      spl = item.identifier.split(',');
      key = spl[0];
      value = spl[1];
    }

    let data: any;

    switch(item.name.toLowerCase()){
      case 'cpu':
        data = this.statsDataEvents;
      break;
      case 'memory':
        data = this.statsDataEvents;
      break;
      case 'pool':
        data = spl ? this.pools.filter(pool => pool[key] == value) : console.warn("DashConfigItem has no identifier!");
        if(data){ data = data[0];}
      break;
      case 'interface':
        data = spl ? this.nics.filter(nic => nic[key] == value) : console.warn("DashConfigItem has no identifier!");
        if(data){ data = data[0].state;}
      break;
    }

    return data ? data : console.warn('Data for this widget is not available!') ;
  }

  toggleShake(){
    if(this.shake){
      this.shake = false;
    } else if(!this.shake){
      this.shake= true;
    }
  }

}
