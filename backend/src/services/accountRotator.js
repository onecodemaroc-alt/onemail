export class AccountRotator {
  constructor(accounts) {
    this.accounts = accounts;
    this.index = 0;
  }

  getNextAvailable() {
    const start = this.index;
    do {
      const account = this.accounts[this.index];
      this.index = (this.index + 1) % this.accounts.length;
      if (account.sentToday < account.dailyLimit) {
        return account;
      }
    } while (this.index !== start);
    return null;
  }

  incrementSent(email) {
    const account = this.accounts.find((a) => a.email === email);
    if (account) account.sentToday++;
  }
}
