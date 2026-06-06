import { defineStore } from 'pinia'

export const useModalsStore = defineStore('modals', {
  state: () => ({
    isWalletModalOpen: false,
    walletId: null,

    isExpenseModalOpen: false,
    expenseId: null,
    expensePreselectedWalletId: null,

    isDebtModalOpen: false,
    debtId: null,
    
    isNoteModalOpen: false,
    noteId: null,
    noteFolderId: null,

    isFileModalOpen: false,
    fileDefaultAlbum: '',

    isDepositModalOpen: false,
    depositWalletId: null,
    depositIsAddMore: false,

    isTransferModalOpen: false,
  }),
  actions: {
    openWalletModal(id = null) {
      this.walletId = id
      this.isWalletModalOpen = true
    },
    closeWalletModal() {
      this.isWalletModalOpen = false
      setTimeout(() => { this.walletId = null }, 300)
    },

    openExpenseModal(id = null, preselectedWalletId = null) {
      this.expenseId = id
      this.expensePreselectedWalletId = preselectedWalletId
      this.isExpenseModalOpen = true
    },
    closeExpenseModal() {
      this.isExpenseModalOpen = false
      setTimeout(() => { 
        this.expenseId = null
        this.expensePreselectedWalletId = null 
      }, 300)
    },

    openDebtModal(id = null) {
      this.debtId = id
      this.isDebtModalOpen = true
    },
    closeDebtModal() {
      this.isDebtModalOpen = false
      setTimeout(() => { this.debtId = null }, 300)
    },

    openNoteModal(id = null, folderId = null) {
      this.noteId = id
      this.noteFolderId = folderId
      this.isNoteModalOpen = true
    },
    closeNoteModal() {
      this.isNoteModalOpen = false
      setTimeout(() => { 
        this.noteId = null
        this.noteFolderId = null 
      }, 300)
    },

    openFileModal(defaultAlbum = '') {
      this.fileDefaultAlbum = defaultAlbum
      this.isFileModalOpen = true
    },
    closeFileModal() {
      this.isFileModalOpen = false
      setTimeout(() => { this.fileDefaultAlbum = '' }, 300)
    },

    openDepositModal(walletId = null, isAddMore = false) {
      this.depositWalletId = walletId
      this.depositIsAddMore = isAddMore
      this.isDepositModalOpen = true
    },
    closeDepositModal() {
      this.isDepositModalOpen = false
      setTimeout(() => { 
        this.depositWalletId = null
        this.depositIsAddMore = false
      }, 300)
    },

    openTransferModal() {
      this.isTransferModalOpen = true
    },
    closeTransferModal() {
      this.isTransferModalOpen = false
    }
  }
})
