import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {DropdownDto} from '../../../shared/dto/common/dropDown/dropdown-dto';
import {AppResponseStatus} from '../../../shared/enums/app-response-status';
import {NotificationService} from '../../../shared/services/notification/notification.service';
import {PaymentService} from '../../../shared/services/payments/payment.service';
import {AppTableKeysData} from '../../../shared/enums/app-table-keys-data';
import {AppTableHeaderActions} from '../../../shared/enums/app-table-header-actions';
import {AppAuthorities} from '../../../shared/enums/app-authorities';
import {AppWindowResolution} from '../../../shared/enums/app-window-resolution';
import {TableSupportBase} from '../../../shared/utility/table-support-base';
import {GridService} from '../../../shared/services/common/table/grid.service';
import {AppConstant} from '../../../shared/utility/app-constant';
import {Table, TableCheckbox} from 'primeng/table';
import {LazyLoadEvent} from 'primeng/api';
import {BillPaymentService} from '../../../shared/services/bill-payment-service/bill-payment.service';
import {PrivilegeService} from '../../../shared/services/privilege.service';
import {OverlayPanel} from 'primeng/overlaypanel';
import {AppEnumConstants} from '../../../shared/enums/app-enum-constants';
import {AppDocumentType} from '../../../shared/enums/app-document-type';
import {UntypedFormArray, UntypedFormBuilder, UntypedFormGroup} from '@angular/forms';
import {BillsService} from '../../../shared/services/bills/bills.service';
import {TableColumnToggleComponent} from '../../common/table-column-toggle/table-column-toggle.component';
import {AppDocuments} from '../../../shared/enums/app-documents';
import {HttpResponseMessage} from '../../../shared/utility/http-response-message';
import {formatDate} from '@angular/common';
import {CommonUtility} from '../../../shared/utility/common-utility';
import {DetailViewService} from '../../../shared/helpers/detail-view.service';
import {
  BulkNotificationDialogService
} from '../../../shared/services/common/bulk-notifications/bulk-notification-dialog.service';
import {CommonMessage} from '../../../shared/utility/common-message';

@Component({
  selector: 'app-create-payment',
  templateUrl: './create-payment.component.html',
  styleUrls: ['./create-payment.component.scss']
})
export class CreatePaymentComponent implements OnInit, OnDestroy {
  public paymentTypes: DropdownDto = new DropdownDto();
  public paymentProviders: DropdownDto = new DropdownDto();

  paymentTypeOnline = true;
  paymentTypeOffline = false;

  public paymentDate: any;
  public paymentReferenceNo: any;
  public showApprovers = false;
  public loading = false;
  public paymentForm: UntypedFormGroup;

  public availableHeaderActions = [];
  public tableSupportBase = new TableSupportBase();
  public appEnumConstants = AppEnumConstants;
  public commonUtil = new CommonUtility();
  public appConstant: AppConstant = new AppConstant();
  public overlayId: any;
  public overlayData: any;
  public tableKeyEnum = AppTableKeysData;
  public enums = AppEnumConstants;
  public appDocumentType = AppDocumentType;

  @ViewChild('dt')
  public table: Table;

  @ViewChild('columnSelect')
  public columnSelect: any;
  @ViewChild('paymentTypeOverlay') paymentTypeOverlay: OverlayPanel;
  @ViewChild('expenseOverlay') expenseOverlay: OverlayPanel;
  @ViewChild('billOverlay') public billOverlay: OverlayPanel;
  @ViewChild('check') check: TableCheckbox;
  public showFilter = false;
  public viewSummaryBool = false;
  public showFilterColumns = false;
  public schedule = false;
  public showSummary = false;
  approvalUserList: DropdownDto = new DropdownDto();
  approvalGroupList: DropdownDto = new DropdownDto();
  paymentObj: any;

  @ViewChild('columnFilterComponent') columnFilterComponent: TableColumnToggleComponent;
  public matchingAutomation: any;
  public isWorkflowConfigAvailable = false;

  @Output() successEmit = new EventEmitter();
  public showUSBankAd = this.privilegeService.isDemo();
  public today = new Date();

  /**
   * Columns Show/ Hide Drop down clicked
   */
  set selectedColumns(val: any[]) {
    this.tableSupportBase.columnChange(val);
  }

  @Input() get selectedColumns(): any[] {
    return this.tableSupportBase.selectedColumns;
  }

  get f() {
    return this.paymentForm.controls;
  }

  onTableResize() {
    this.tableSupportBase.isTableInResponsive = !(window.innerWidth <= AppWindowResolution.MIN_INNER_WINDOW_WIDTH);
  }

  constructor(public notificationService: NotificationService, public paymentService: PaymentService,
              public gridService: GridService, public billPaymentService: BillPaymentService, public billsService: BillsService,
              public privilegeService: PrivilegeService, public formBuilder: UntypedFormBuilder,
              public detailViewService: DetailViewService, public bulkNotificationDialogService: BulkNotificationDialogService) {
  }

  /**
   * Destroys Table session state when redirecting
   */
  ngOnDestroy(): void {
    sessionStorage.removeItem(AppTableKeysData.PAYMENT_TABLE_KEY);
  }

  ngOnInit(): void {
    this.availableHeaderActions.push(AppTableHeaderActions.FILTER);
    this.availableHeaderActions.push(AppTableHeaderActions.COLUMNS);
    this.availableHeaderActions.push(AppTableHeaderActions.REFRESH);
    this.initForm();
    this.getPaymentProviders();
    this.initApprover();
    this.loadTableData();
    this.getApprovalUserList();
    this.getApprovalGroupList();
  }

  /**
   * Initialize the form
   */
  initForm() {
    this.paymentForm = this.formBuilder.group({
      documentType: [this.appDocumentType.BILL],
      isOnline: [this.paymentTypeOffline],
      paymentType: [null],
      providerId: [null],
      paymentDate: [null],
      referenceNo: [null],
      time: [null],
      status: [null],
      date: [null],
      isScheduled: [null],
      scheduledTime: [null],
      scheduledDateStr: [null],
      isSubmitted: [null],
      transactionList: [[]],
      adHocWorkflowDetails: this.formBuilder.array([]),
    });

    this.paymentForm.get('isOnline').valueChanges.subscribe(val => {
      this.paymentMethodChange();
    });

    this.paymentForm.get('documentType').valueChanges.subscribe(value => {
      this.documentChange(value);
    });
  }

  /**
   * Bulk Payment method field change event
   */
  paymentMethodChange() {
    if (!this.paymentForm.get('isOnline').value) {
      this.schedule = false;
      this.getOfflinePaymentType();
    } else {
      this.getPaymentType();
    }
    this.paymentForm.get('paymentType').reset();
    this.paymentForm.get('paymentDate').reset();
    this.paymentForm.get('referenceNo').reset();

    this.tableSupportBase.rows = [];
    this.loadData(this.tableSupportBase.searchFilterDto);
  }

  /**
   * Bulk Document field change event
   * @param value value of document field
   */
  documentChange(value) {
    if (!value) {
      return;
    }
    this.paymentForm.get('paymentDate').reset();
    this.paymentForm.get('referenceNo').reset();
    this.tableSupportBase.rows = [];
    this.columnFilterComponent.resetFilters();
    this.matchingAutomation = null;
    this.isWorkflowConfigAvailable = false;
  }

  /**
   * Get Approval group list
   */
  getApprovalGroupList() {
    this.billsService.getApprovalGroupList(true).subscribe((res: any) => {
      if (AppResponseStatus.STATUS_SUCCESS === res.status) {
        this.approvalGroupList.data = res.body;
      }
    }, error => {
      this.notificationService.errorMessage(error);
    });
  }

  /**
   * Get Approval Users List
   */
  getApprovalUserList() {
    const authorities = [AppAuthorities.PAYMENT_APPROVE, AppAuthorities.PAYMENT_REJECT,
      AppAuthorities.PAYMENT_OVERRIDE_APPROVAL];
    this.billsService.getApprovalUserList(null, authorities, true).subscribe((res: any) => {
      if (AppResponseStatus.STATUS_SUCCESS === res.status) {
        this.approvalUserList.data = res.body;
      }
    }, error => {
      this.notificationService.errorMessage(error);
    });
  }

  /**
   * this method can be used to init approver dropdown
   */
  initApprover() {
    this.addAdHocWorkflowDetail();
  }

  /**
   * remove AddHocWorkflow
   * @param index number
   */
  removeAdHocWorkflow(index: number) {
    this.adHocWorkflowDetails.removeAt(index);
  }

  /**
   * Add new approver
   */
  addAdHocWorkflowDetail() {
    const addHocWorkflowDetail = this.formBuilder.group({
      id: [null],
      approvalOrder: [null],
      approvalGroup: [null],
      approvalUser: [null],
      completed: [false]
    });
    this.adHocWorkflowDetails.push(addHocWorkflowDetail);
    const adHocWorkFlowOrderNumber = this.adHocWorkflowDetails.length;
    this.adHocWorkflowDetails.controls[adHocWorkFlowOrderNumber - 1].get('approvalOrder').patchValue(adHocWorkFlowOrderNumber);
  }

  /**
   * This method use for get payment Provider list
   */
  getPaymentProviders() {
    this.paymentService.getPaymentProviders().subscribe({
      next: (res: any) => {
        if (AppResponseStatus.STATUS_SUCCESS === res.status) {
          this.paymentProviders.data = res.body;
          this.setDefaultPaymentProvider();
        }
      },
      error: err => this.notificationService.errorMessage(err)
    });
  }

  /**
   * Set default payment provider
   */
  setDefaultPaymentProvider() {
    this.paymentForm.get('providerId').patchValue(this.paymentProviders.data.find(x => x.trueFalseData === true)?.id);
    this.paymentMethodChange();
  }

  /**
   * This method use for get payment type list
   */
  getPaymentType() {
    if (!this.paymentForm.get('providerId').value) {
      return;
    }
    this.paymentService.getPaymentTypeForProvider(this.paymentForm.get('providerId').value).subscribe({
      next: (res: any) => {
        if (AppResponseStatus.STATUS_SUCCESS === res.status) {
          this.paymentTypes.data = res.body;
        }
      },
      error: err => this.notificationService.errorMessage(err)
    });
  }

  getOfflinePaymentType() {
    this.billPaymentService.getPaymentTypeList().subscribe((res: any) => {
      if (AppResponseStatus.STATUS_SUCCESS === res.status) {
        this.paymentTypes.data = res.body;
      }
    }, error => {
      this.notificationService.errorMessage(error);
    });
  }


  /**
   * This method can use for get controllers in form array
   */
  public get adHocWorkflowDetails() {
    return this.paymentForm.get('adHocWorkflowDetails') as UntypedFormArray;
  }

  /**
   * this method can be used to get discount amount of the invoice
   */
  async getDiscountAmount(line) {
    if (this.f.documentType.value === AppDocumentType.EXPENSE_REPORT) {
      return;
    }

    if (line['doc.txnAmount'] == null) {
      return;
    }

    if (this.f.isOnline.value) {
      this.paymentService.getBalanceAmount(line['doc.txnAmount'], line.id).subscribe({
        next: (res: any) => {
          if (AppConstant.HTTP_RESPONSE_STATUS_SUCCESS === res.status) {
            line['doc.applicableDiscountAmount'] = res.body;
          } else {
            this.notificationService.infoMessage(res.body.message);
          }
        }
      });
      return;
    }

    if (!line['doc.paymentDate']) {
      return;
    }

    const clonedData = Object.assign(line);
    try {
      clonedData['doc.paymentDate'] = clonedData['doc.paymentDate'].toLocaleDateString(AppConstant.LOCAL_PRAM_US_ENGLISH);
    } catch (e) {
    }

    const obj = {
      amount: clonedData['doc.txnAmount'],
      billId: clonedData.id,
      paymentDateStr: clonedData['doc.paymentDate']
    };

    const httpData: any = await this.billPaymentService.getDiscountAmountByPayment(obj);
    if (AppConstant.HTTP_RESPONSE_STATUS_SUCCESS === httpData.status) {
      line['doc.applicableDiscountAmount'] = httpData.body;
    } else {
      this.notificationService.infoMessage(httpData.body.message);
    }
  }

  /**
   * Loads Table Data (Settings)
   */
  loadTableData() {
    this.selectedColumns = [];
    // Check for Responsiveness
    this.onTableResize();
    // Removes table Storage on load if present
    sessionStorage.removeItem(AppTableKeysData.PAYMENT_TABLE_KEY);
    this.gridService.getTableStructure(this.appConstant.GRID_PAYMENT_CREATE).subscribe((res: any) => {
      this.tableSupportBase.tableDataProcess(this.table, res, AppTableKeysData.PAYMENT_TABLE_KEY, this.columnSelect);
    });
  }

  /**
   * Load Data list on Initial
   * @param event table lazy event
   */
  loadData(event: LazyLoadEvent) {
    if (!this.f.documentType.value) {
      return;
    }
    this.tableSupportBase.searchFilterDto = event;
    this.billPaymentService.getApprovedDocuments(this.tableSupportBase.searchFilterDto, this.f.documentType.value).subscribe((res: any) => {
      this.tableSupportBase.dataSource = res.body.data;
      this.updateDataSourceWithFilledValues();
      this.tableSupportBase.totalRecords = res.body.totalRecords;
      if (this.tableSupportBase.totalRecords === 0) {
        this.table.currentPageReportTemplate = this.table.currentPageReportTemplate.replace('{first}', '0');
      } else {
        this.table.currentPageReportTemplate = this.table.currentPageReportTemplate.replace('0', '{first}');
      }
    });
  }

  /**
   * Update the table response with the previously filled values
   */
  updateDataSourceWithFilledValues() {
    console.table(this.tableSupportBase.rows)
    this.tableSupportBase.rows.forEach(val1 => {
      for (let i = 0; this.tableSupportBase.dataSource.length > i; i++) {
        if (this.tableSupportBase.dataSource[i].id === val1.id) {
          this.tableSupportBase.dataSource[i] = val1;
        }
      }
    });
  }

  /**
   * this method can be used to save table state
   */
  onTableChanged(event?) {
    const promise = this.tableSupportBase.tableChanged(this.table, AppTableKeysData.PAYMENT_TABLE_KEY);
    promise.then(result => {
      this.tableSupportBase.tableDataOptions = result;
      this.tableSupportBase.tableDataOptions.gridName = this.appConstant.GRID_PAYMENT_CREATE;
      this.gridService.updateTableState(this.tableSupportBase.tableDataOptions).subscribe((res: any) => {
        if (event === true) {
          this.loadTableData();
        }
        if (res.status === AppConstant.HTTP_RESPONSE_STATUS_SUCCESS) {
        } else {
          this.notificationService.errorMessage(res.body.message);
        }
      }, error => {
        this.notificationService.errorMessage(error);
      });
    });
  }

  /**
   * A Single value hover from table
   * @param field to filed
   * @param obj to customer obj
   * @param event to click event
   */
  tdHover(field, obj: any, event) {
    if (field === 'doc.docNo') {
      if (this.f.documentType.value === AppDocumentType.BILL &&
        this.privilegeService.isAuthorized(AppAuthorities.BILL_DETAIL_VIEW)) {
        this.overlayId = obj.id;
        showOverlay(this.billOverlay);
      }
      if (this.f.documentType.value === AppDocumentType.EXPENSE_REPORT &&
        this.privilegeService.isAuthorized(AppAuthorities.EXPENSES_DETAIL_VIEW)) {
        this.overlayId = obj.id;
        showOverlay(this.expenseOverlay);
      }
    }

    if (field === 'doc.payee') {
      this.overlayId = obj.id;
      this.overlayData = obj;
      if (obj.acceptedPaymentTypeList && obj.acceptedPaymentTypeList.length !== 0){
        showOverlay(this.paymentTypeOverlay);
      }
    }

    function showOverlay(overlay) {
      if (overlay.target === null || overlay.target === undefined) {
        overlay.show(event);
      }
    }
  }

  /**
   * Is the field is has data to show in overlay
   * @param field column
   * @param data row data
   */
  isClassHover(field, data) {
    switch (field) {
      case 'doc.docNo': {
        if (this.f.documentType.value === AppDocumentType.BILL) {
          return !!this.privilegeService.isAuthorized(AppAuthorities.BILL_DETAIL_VIEW);
        }
        if (this.f.documentType.value === AppDocumentType.EXPENSE_REPORT) {
          return !!this.privilegeService.isAuthorized(AppAuthorities.EXPENSES_DETAIL_VIEW);
        }
        break;
      }
      case 'doc.payee': {
        if (!data.acceptedPaymentTypeList){
          return false;
        }

        if (data.acceptedPaymentTypeList.length === 0){
          return false;
        } else {
          return true;
        }
      }
    }
  }

  /**
   * A Single value clicked from table
   * @param field to filed
   * @param obj to customer obj
   */
  tdClick(field, obj: any) {
    if (field === 'doc.docNo') {
      if (this.f.documentType.value === AppDocumentType.BILL && this.privilegeService.isAuthorized(AppAuthorities.BILL_DETAIL_VIEW)) {
        this.detailViewService.openBillDetailView(obj.id);
      }
      if (this.f.documentType.value === AppDocumentType.EXPENSE_REPORT &&
        this.privilegeService.isAuthorized(AppAuthorities.EXPENSES_DETAIL_VIEW)) {
        this.detailViewService.openExpenseDetailView(obj.id);
      }
    }
  }

  /**
   * Hide Overlays if Visible
   */
  hideOverlays() {
    if (this.billOverlay.overlayVisible) {
      this.billOverlay.hide();
    }
    if (this.expenseOverlay.overlayVisible) {
      this.expenseOverlay.hide();
    }
    if (this.paymentTypeOverlay.overlayVisible) {
      this.paymentTypeOverlay.hide();
    }
  }

  /**
   * Return the total in array for summary
   */
  getTotal() {
    return this.tableSupportBase.rows.reduce((a, b) => a + (b['doc.txnAmount'] || 0), 0);
  }

  /**
   * Reset the form
   */
  resetForm() {
    this.schedule = false;
    this.showApprovers = false;
    this.paymentForm.reset();
    this.tableSupportBase.rows = [];
    this.setDefaultPaymentProvider();
    this.matchingAutomation = null;
    this.isWorkflowConfigAvailable = false;
    this.columnFilterComponent.resetFilters();
    this.paymentForm.get('documentType').patchValue(this.appDocumentType.BILL);
    this.paymentForm.get('isOnline').patchValue(this.paymentTypeOffline);
    this.initApprover();
    this.loadData(this.tableSupportBase.searchFilterDto);
  }

  /**
   * Update the fields with bulk values in row select
   * clears every value in the row if unselects
   * @param event event
   */
  rowSelected(event: any) {
    if (this.tableSupportBase.dataSource.length) {
      this.tableSupportBase.dataSource.forEach(val => {
        if (this.tableSupportBase.rows.some(x => x.id === val.id)) {
          val.selected = true;
          if (val.valuesPatched) {
            return;
          }
          val.valuesPatched = true;
          if (this.f.referenceNo.value && !val['doc.referenceNo']) {
            val['doc.referenceNo'] = this.f.referenceNo.value;
          }
          if (this.f.paymentDate.value && !val['doc.paymentDate']) {
            val['doc.paymentDate'] = this.f.paymentDate.value;
          }
          if (this.f.paymentType.value && !val['doc.txnType']) {
            val['doc.txnType'] = this.f.paymentType.value;
          }
          this.getDiscountAmount(val);
        } else {
          val.selected = false;
          val.valuesPatched = false;
          val['doc.referenceNo'] = null;
          val['doc.paymentDate'] = null;
          val['doc.txnType'] = null;
          val['doc.comment'] = null;
          val['doc.creditAmount'] = null;
        }
      });
    }
  }

  /**
   * In every value change update these fields if bulk values are entered
   * @param payment object
   * @param type payment type
   * @param date payment date
   * @param ref payment ref no
   */
  patchBulkValues(payment: any, type, date, ref) {
    if (payment.valuesPatched) {
      return;
    }
    this.tableSupportBase.rows.push(payment);

    payment.valuesPatched = true;

    if (type) {
      if (this.f.paymentDate.value && !payment['doc.paymentDate']) {
        payment['doc.paymentDate'] = this.f.paymentDate.value;
      }
      if (this.f.referenceNo.value && !payment['doc.referenceNo']) {
        payment['doc.referenceNo'] = this.f.referenceNo.value;
      }
      return;
    }
    if (date) {
      if (this.f.paymentType.value && !payment['doc.txnType']) {
        payment['doc.txnType'] = this.f.paymentType.value;
      }
      if (this.f.referenceNo.value && !payment['doc.referenceNo']) {
        payment['doc.referenceNo'] = this.f.referenceNo.value;
      }
      return;
    }
    if (ref) {
      if (this.f.paymentType.value && !payment['doc.txnType']) {
        payment['doc.txnType'] = this.f.paymentType.value;
      }
      if (this.f.paymentDate.value && !payment['doc.paymentDate']) {
        payment['doc.paymentDate'] = this.f.paymentDate.value;
      }
      return;
    }
    if (this.f.paymentType.value && !payment['doc.txnType']) {
      payment['doc.txnType'] = this.f.paymentType.value;
    }
    if (this.f.paymentDate.value && !payment['doc.paymentDate']) {
      payment['doc.paymentDate'] = this.f.paymentDate.value;
    }
    if (this.f.referenceNo.value && !payment['doc.referenceNo']) {
      payment['doc.referenceNo'] = this.f.referenceNo.value;
    }
  }

  /**
   * Update the slected table row with the latest change done in row on focus out
   * @param payment object
   */
  updateSelectedArray(payment: any) {
    const i = this.tableSupportBase.rows.findIndex(x => x.id === payment.id);
    if (i === undefined || i === null || i < 0) {
      return;
    }
    this.tableSupportBase.rows[i].selected = true;
    const tempSelectedData = Object.assign([], this.tableSupportBase.rows);
    this.table.selectionKeys[this.tableSupportBase.rows[i].id] = 1;
    this.tableSupportBase.rows = tempSelectedData;
    this.tableSupportBase.rows[i] = payment;
  }

  /**
   * Submit, Schedule or Pay a transaction
   * @param status status of the button clicked
   */
  submitPayment(status) {
    const transactionList: any[] = Object.assign([], this.tableSupportBase.rows);
    this.loading = true;
    const tempTransactionList: any[] = [];
    transactionList.forEach(value => {
      const transactionObj = {
        documentId: null, txnType: null, txnDate: null, txnRef: null, amount: null,
        comment: null, creditAmount: null, receipt: null, payee: null, dueDate: null,
        docNo: null, disc: undefined

      };
      transactionObj.documentId = value.id;
      transactionObj.txnType = value['doc.txnType'];
      if (value['doc.paymentDate']) {
        try {
          transactionObj.txnDate = value['doc.paymentDate'].toLocaleDateString(AppConstant.LOCAL_PRAM_US_ENGLISH);
        } catch (e) {
          transactionObj.txnDate = value['doc.paymentDate'];
        }
      }
      transactionObj.txnRef = value['doc.referenceNo'];
      transactionObj.amount = value['doc.txnAmount'];
      transactionObj.comment = value['doc.comment'];
      transactionObj.creditAmount = value['doc.creditAmount'];
      transactionObj.receipt = value['doc.receipt'];
      transactionObj.payee = value['doc.payee'];
      transactionObj.dueDate = value['doc.dueDate'];
      transactionObj.docNo = value['doc.docNo'];
      transactionObj.disc = value['doc.applicableDiscountAmount'];
      tempTransactionList.push(transactionObj);
    });
    this.paymentForm.get('transactionList').patchValue(tempTransactionList);
    this.paymentForm.get('isScheduled').patchValue(this.schedule);
    this.paymentForm.get('isSubmitted').patchValue(this.showApprovers);
    this.paymentForm.get('status').patchValue(status);

    if (this.paymentForm.get('time').value) {
      this.paymentForm.get('scheduledTime').patchValue(formatDate(this.paymentForm.get('time').value, 'h:MM', 'en-US'));
    }

    if (this.paymentForm.get('date').value) {
      this.paymentForm.get('scheduledDateStr').patchValue(
        this.paymentForm.get('date').value.toLocaleDateString(AppConstant.LOCAL_PRAM_US_ENGLISH));
    }

    if (this.paymentForm.get('isOnline').value) {
      this.paymentService.getSummaryForPayment(this.paymentForm.value).subscribe({
        next: (res: any) => {
          if (res.status === AppConstant.HTTP_RESPONSE_STATUS_SUCCESS) {
            this.paymentObj = res.body;
            this.showSummary = true;
          } else {
            this.notificationService.infoMessage(res.body.message);
          }
          this.loading = false;
        }, error: (err) => {
          this.notificationService.errorMessage(err);
          this.loading = false;
        }
      });
      return;
    }
    this.create(this.paymentForm.value);
  }

  /**
   * Create Api
   * @param data
   */
  create(data) {
    this.paymentService.createPayment(data).subscribe({
      next: (res: any) => {
        if (res.status === AppConstant.HTTP_RESPONSE_STATUS_CREATED) {
          if (this.schedule) {
            this.notificationService.successMessage(HttpResponseMessage.PAYMENT_SCHEDULED_SUCCESSFULLY);
          } else if (this.showApprovers) {
            this.notificationService.successMessage(HttpResponseMessage.PAYMENT_SUBMITTED_SUCCESSFULLY);
          } else {
            this.notificationService.successMessage(HttpResponseMessage.PAYMENT_CREATED_SUCCESSFULLY);
          }
          this.loading = false;
          this.showSummary = false;
          this.successEmit.emit(true);
        } else {
          this.notificationService.infoMessage(res.body.message);
          this.loading = false;
        }
      }, error: (err) => {
        this.notificationService.errorMessage(err);
        this.loading = false;
      }
    });
  }


  /**
   * Automation Call
   */
  valueChanged() {
    const data: any = {};
    data.vendorId = this.f.paymentType.value;
    data.batchTotal = this.getTotal();
    data.event = AppDocuments.DOCUMENT_EVENT_SUBMITTED;
    this.paymentService.valuesChanged(data).then(async (res: any) => {
      if (AppConstant.HTTP_RESPONSE_STATUS_SUCCESS === await res.status) {
        if (res.body) {
          this.matchingAutomation = res.body.automationWorkflowConfigs;
          this.isWorkflowConfigAvailable = res.body.workflowConfigAvailable;
          this.showApprovers = true;
          this.schedule = false;
        } else {
          this.matchingAutomation = null;
          this.isWorkflowConfigAvailable = false;
        }
      }
    });
  }

  /**
   * Enable the reference no if the payment type is cheque in online payments
   * @param data payment method
   */
  isReferenceNoDisabled(data) {
    if (data === AppConstant.PAYMENT_TYPE_CHECK) {
      return true;
    }
    return this.f.isOnline.value !== this.paymentTypeOnline;
  }

  /**
   * clear the reference no if the payment is online and payment
   * type is change to something else from online
   * @param fromHeader where its called from
   * @param data table data record
   */
  paymentTypeChange(fromHeader, data) {
    if (this.f.isOnline.value === this.paymentTypeOnline) {
      if (fromHeader && this.f.paymentType.value !== AppConstant.PAYMENT_TYPE_CHECK) {
        this.f.referenceNo.patchValue(null);
        return;
      }
      if (!fromHeader && data['doc.txnType'] !== AppConstant.PAYMENT_TYPE_CHECK) {
        data['doc.referenceNo'] = null;
        return;
      }
    }
  }

  paymentProviderChanged(value) {
    this.columnFilterComponent.resetFilters();
    this.tableSupportBase.rows = [];
    this.loadData(this.tableSupportBase.searchFilterDto);
    this.getPaymentType();
  }

  onClickReceipt(receiptID: any) {
    document.getElementById(receiptID).click();
  }

  /**
   * this method can be use to change file receipt
   * @param event to event to change event
   * @param obj
   */
  changeReceipt(event, obj) {
    if (this.validateExpenseAttachments(event.target.files[0])) {
      obj['doc.receipt'] = event.target.files[0];
      this.patchBulkValues(obj, false, false, false);
      setTimeout(() => {
        this.updateSelectedArray(obj);
      }, 150);
    }
  }

  /**
   * validate additional attachments
   * @param file to file
   */
  validateExpenseAttachments(file) {
    if ((file.size / 1024 / 1024) > AppConstant.COMMON_FILE_SIZE) {
      this.notificationService.errorMessage(CommonMessage.INVALID_FILE_SIZE);
      return false;
    } else {
      return true;
    }
  }

  /**
   * this method can be used to clear receipt
   * @param i to index
   */
  clearReceipt(obj) {
    obj['doc.receipt'] = null;
  }

  viewSummary() {
    this.viewSummaryBool = true;
  }

  close() {
    this.successEmit.emit();
  }

  /**
   * this method can be used to get label according to status
   */

  getStatus(status) {
    switch (status) {
      case AppEnumConstants.PAYMENT_STATUS_PAID: {
        return AppEnumConstants.PAYMENT_LABEL_PAID;
      }
      case AppEnumConstants.PAYMENT_STATUS_NOT_PAID: {
        return AppEnumConstants.PAYMENT_LABEL_NOT_PAID;
      }
      case AppEnumConstants.PAYMENT_STATUS_PARTIALLY_PAID: {
        return AppEnumConstants.PAYMENT_LABEL_PARTIALLY_PAID;
      }
      case AppEnumConstants.PAYMENT_STATUS_PROCESSING: {
        return AppEnumConstants.PAYMENT_LABEL_PROCESSING;
      }
    }

  }

  getButtonDetailsForSummary() {
    const obj = {icon: '', label: ''};
    if (!this.showApprovers && !this.schedule) {
      obj.label = 'Pay';
      obj.icon = 'fa-solid fa-coins';
    }
    if (this.showApprovers && !this.schedule) {
      obj.label = 'Submit for Approval';
      obj.icon = 'fa-solid fa-share-from-square';
    }
    if (!this.showApprovers && this.schedule) {
      obj.label = 'Schedule';
      obj.icon = 'pi pi-clock';
    }
    return obj;
  }

  getCurrentTime() {
    const now = new Date();
    this.paymentForm.controls.time.setValue(now);
  }

  showPaymentDetailsValidIcon(payment) {
    if (this.f.isOnline.value === this.paymentTypeOffline) {
      return false;
    }

    if (!payment['doc.txnType']) {
      return false;
    }

    if (!payment.acceptedPaymentTypeList) {
      return false;
    }

    if (!payment.acceptedPaymentTypeList.find(x => x.id === payment['doc.txnType'])){
      return false;
    }

    return !payment.acceptedPaymentTypeList.find(x => x.id === payment['doc.txnType'])?.trueFalseData;
  }
}
