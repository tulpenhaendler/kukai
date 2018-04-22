import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { MessageService } from './message.service';
import { UpdateCoordinatorService } from './update-coordinator.service';
import { KeyPair } from './../interfaces';
import { Buffer } from 'buffer';
import * as libs from 'libsodium-wrappers';
import * as Bs58check from 'bs58check';

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};
const prefix = {
  tz1: new Uint8Array([6, 161, 159]),
  edpk: new Uint8Array([13, 15, 37, 217]),
  edsk: new Uint8Array([43, 246, 78, 7]),
  edsig: new Uint8Array([9, 245, 205, 134, 18]),
  o: new Uint8Array([5, 116]),
};

@Injectable()
export class OperationService {
  tzfull = 1000000;
  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    private updateCoordinatorService: UpdateCoordinatorService
  ) { }
  async activate(pkh: string, secret: string) {
    console.log('ACTIVATE');
    console.log('Request head');
    let branch;
    let chain_id;
    this.http.get('http://zeronet-api.tzscan.io/v2/head').subscribe(
      (data: any) => {
        branch = data.hash;
        chain_id = data.chain_id; },
      err => console.log(JSON.stringify(err)),
      () => {
        console.log('Request forge/operations');
        const op = {
          branch: branch,
          operations: [{
            kind: 'activation',
            pkh: pkh,
            secret: secret}
          ]
        };
        let soc;
        this.http.post('http://zeronet-node.tzscan.io/blocks/head/proto/helpers/forge/operations', op).subscribe(
          (data: any) => {
              soc = data.operation;
            },
          err => console.log(JSON.stringify(err)),
          () => {
            console.log('Inject operations');
            const sop = {
              signedOperationContents: soc,
              chain_id: chain_id
            };
            this.http.post('http://zeronet-node.tzscan.io/inject_operation', sop).subscribe(
              data => console.log(JSON.stringify(data)),
              err => console.log(JSON.stringify(err)),
              () => {
                this.updateCoordinatorService.boost();
                this.messageService.addSuccess('Genesis wallet activated! Please wait for balance to update...');
              }
            );
          }
        );
      }
    );
  }
  originate(keys: KeyPair, pkh: string, amount: number, fee: number): boolean {
    console.log('ORIGINATE');
    console.log(pkh);
    console.log(JSON.stringify(keys));
    console.log('Request head');
    let branch;
    let chain_id;
    let predecessor_hash;
    this.http.get('http://zeronet-api.tzscan.io/v2/head').subscribe(
      (data: any) => {
        branch = data.hash;
        predecessor_hash = data.predecessor_hash;
        chain_id = data.chain_id; },
      err => { console.log(JSON.stringify(err)); return false; },
      () => {
        let counter;
        this.http.post('http://zeronet-node.tzscan.io/blocks/head/proto/context/contracts/' + pkh, {}).subscribe(
          (data: any) => counter = Number(data.counter),
          err => console.log(JSON.stringify(err)),
          () => {
            const fop = {
              branch: branch,
              kind: 'manager',
              source: pkh,
              fee: fee * this.tzfull,
              counter: ++counter,
              operations: [
                {
                  kind: 'reveal',
                  public_key: keys.pk
                },
                {
                  kind: 'origination',
                  managerPubkey: pkh,
                  balance: amount * this.tzfull,
                  spendable: true,
                  delegatable: true
                }
              ]
            };
            let opbytes;
            this.messageService.addSuccess('Counter is: ' + counter);
            this.http.post('http://zeronet-node.tzscan.io/blocks/head/proto/helpers/forge/operations', fop).subscribe(
              (data: any) => {
                  opbytes = data.operation;
                },
              err => console.log(JSON.stringify(err)),
              () => {
                this.messageService.addSuccess('opbytes is: ' + opbytes);
                //     opbytes = f.operation;
                // var operationHash = utility.b58cencode(library.sodium.crypto_generichash(32, utility.hex2buf(opbytes)), prefix.o);
                const signed = this.sign(opbytes, keys.sk);
                const sopbytes = signed.sbytes;
                const opHash = this.b58cencode(libs.crypto_generichash(32, this.hex2buf(sopbytes)), prefix.o);
                const aop = {
                  pred_block: predecessor_hash,
                  operation_hash: opHash,
                  forged_operation: opbytes,
                  signature: signed.edsig
                };
                this.http.post('http://zeronet-node.tzscan.io/blocks/head/proto/helpers/apply_operation', aop).subscribe(
                  (data: any) => {
                      // soc = data.operation;
                      console.log(JSON.stringify(data));
                    },
                  err => console.log(JSON.stringify(err)),
                  () => {
                    console.log('Inject operations');
                    const sop = {
                      signedOperationContents: sopbytes,
                      chain_id: chain_id
                    };
                    this.http.post('http://zeronet-node.tzscan.io/inject_operation', sop).subscribe(
                      data => console.log(JSON.stringify(data)),
                      err => console.log(JSON.stringify(err)),
                      () => {
                        this.updateCoordinatorService.boost();
                        this.messageService.addSuccess('Origination successfully broadcasted to the network');
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
    return false;
  }
  hex2buf(hex) {
    return new Uint8Array(hex.match(/[\da-f]{2}/gi).map(function (h) {
      return parseInt(h, 16);
    }));
  }
  buf2hex(buffer) {
    const byteArray = new Uint8Array(buffer), hexParts = [];
    for (let i = 0; i < byteArray.length; i++) {
      const hex = byteArray[i].toString(16);
      const paddedHex = ('00' + hex).slice(-2);
      hexParts.push(paddedHex);
    }
    return hexParts.join('');
  }
  b58cencode(payload: any, prefixx: Uint8Array) {
    const n = new Uint8Array(prefixx.length + payload.length);
    n.set(prefixx);
    n.set(payload, prefixx.length);
    return Bs58check.encode(new Buffer(this.buf2hex(n), 'hex'));
  }
  b58cdecode(enc, prefixx) {
    let n = Bs58check.decode(enc);
    n = n.slice(prefixx.length);
    return n;
  }
  sign(bytes, sk): any {
    const sig = libs.crypto_sign_detached(this.hex2buf(bytes), this.b58cdecode(sk, prefix.edsk), 'uint8array');
    const edsig = this.b58cencode(sig, prefix.edsig);
    const sbytes = bytes + this.buf2hex(sig);
    return {
      bytes: bytes,
      sig: sig,
      edsig: edsig,
      sbytes: sbytes,
    };
  }
}
