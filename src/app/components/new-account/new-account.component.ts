import { Component, OnInit, ElementRef, ViewChild, TemplateRef } from '@angular/core';
import { WalletService } from '../../services/wallet.service';
import { MessageService } from '../../services/message.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { KeyPair } from '../../interfaces';
import { OperationService } from '../../services/operation.service';

@Component({
  selector: 'app-new-account',
  templateUrl: './new-account.component.html',
  styleUrls: ['./new-account.component.scss']
})
export class NewAccountComponent implements OnInit {
  @ViewChild('modal1') modal1: TemplateRef<any>;
  identity = this.walletService.wallet.accounts[0];
  // accounts = this.walletService.wallet.accounts;
  fromPkh: string;
  amount: string;
  fee: string;
  password: string;
  modalRef1: BsModalRef;
  modalRef2: BsModalRef;
  modalRef3: BsModalRef;
  formInvalid = '';
  pwdValid: string;
  sendResponse = '';
  constructor(
    private walletService: WalletService,
    private messageService: MessageService,
    private modalService: BsModalService,
    private operationService: OperationService
  ) { }

  ngOnInit() {
    if (this.identity) {
      this.init();
    }
  }
  init() {
    this.fromPkh = this.identity.pkh;
  }
  open1(template1: TemplateRef<any>) {
    this.clearForm();
    this.modalRef1 = this.modalService.show(template1, { class: 'modal-sm' });
  }
  open2(template: TemplateRef<any>) {
    this.formInvalid = this.invalidInput();
    if (!this.formInvalid) {
      if (!this.fee) { this.fee = '0'; }
      this.close1();
      this.modalRef2 = this.modalService.show(template, { class: 'second' });
    }
  }
  async open3(template: TemplateRef<any>) {
    const pwd = this.password;
    this.password = '';
    let keys;
    if (keys = this.walletService.getKeys(pwd)) {
      this.pwdValid = '';
      this.close2();
      this.modalRef3 = this.modalService.show(template, { class: 'third' });
      this.newAccount(keys);
    } else {
      this.pwdValid = 'Wrong password!';
    }
  }
  close1() {
    this.modalRef1.hide();
    this.modalRef1 = null;
  }
  close2() {
    this.modalRef2.hide();
    this.modalRef2 = null;
  }
  close3() {
    this.modalRef3.hide();
    this.modalRef3 = null;
  }
  async newAccount(keys: KeyPair) {
    let amount = this.amount;
    let fee = this.fee;
    this.amount = '';
    this.fee = '';
    if (!amount) { amount = '0'; }
    if (!fee) { fee = '0'; }
    setTimeout(async () => {
      if (this.operationService.originate(keys, this.fromPkh, Number(amount), Number(fee) * 100)) {
        this.sendResponse = 'success';
      } else {
        this.sendResponse = 'failure';
      }
    }, 100);
  }
  invalidInput(): string {
    if (!Number(this.amount) || Number(this.amount) < 0) {
      return 'invalid amount';
    } else if (!Number(this.fee) && this.fee && this.fee !== '0') {
      return 'invalid fee';
    } else {
      return '';
    }
  }
  clearForm() {
    this.amount = '';
    this.fee = '';
    this.password = '';
    this.pwdValid = '';
    this.formInvalid = '';
    this.sendResponse = '';
  }
}
