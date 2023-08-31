import React, { Component } from "react";
import Pipeline from '@pipeline-ui-2/pipeline/index'; //change to import Pipeline from 'Pipeline for realtime editing Pipeline index.js, and dependency to: "Pipeline": "file:..",

import algosdk from 'algosdk'

window.fundingDetails = {
  amount: 3000000
}

var refresh = false

var ready = false

const myAlgoWallet = Pipeline.init();

Pipeline.main = false;

var mynet = (Pipeline.main) ? "MainNet" : "TestNet";

const tealNames = ["daoDeposit"]

const tealContracts = {
  daoDeposit: {},
}

async function getContracts() {
  for (let i = 0; i < tealNames.length; i++) {
    let name = tealNames[i]
    let data = await fetch("teal/" + name + ".txt")
    tealContracts[name].program = await data.text()
    let data2 = await fetch("teal/" + name + " clear.txt")
    tealContracts[name].clearProgram = await data2.text()
  }
}

class App extends Component {

  constructor(props) {
    super(props)
    this.state = {
      net: mynet,
      txID: "",
      myAddress: "",
      balance: 0,
      appAddress: "",
      goal: window.fundingDetails.amount,
      level: 0,
      fundAmount: "Not fetched yet...",
      share: 0,
      depositAmount: 0,
      myProfits: 0,
      withdrawn: 0,
      contribution: 0
    }
  }

  componentDidMount() {
    getContracts()
  }

  fetchBalance = (addr) => {
    Pipeline.balance(addr).then(
      data => {
        this.setState({ balance: data });
      }
    );
  }

  setNet = (event) => {
    if (event.target.value === "TestNet") {
      Pipeline.main = false
      this.setState({ net: "TestNet" })
    }
    else {
      Pipeline.main = true
      this.setState({ net: "MainNet" })
    }

  }

  handleConnect = () => {
    Pipeline.connect(myAlgoWallet).then(
      data => {
        this.setState({ myAddress: data });
        setInterval(() => this.fetchBalance(this.state.myAddress), 5000)
      }
    );
  }

  switchConnector = (event) => {
    Pipeline.pipeConnector = event.target.value
    console.log(Pipeline.pipeConnector)
  }

  deploy = async () => {

    let name = "daoDeposit"

    Pipeline.deployTeal(tealContracts[name].program, tealContracts[name].clearProgram, [1, 1, 2, 6], ["create"]).then(data => {
      document.getElementById("appid").value = data;
      this.setState({ appAddress: algosdk.getApplicationAddress(data) });
    })
  }

  delete = async () => {
    Pipeline.deleteApp(document.getElementById("appid").value).then(data => {
      this.setState({ txID: data })
    })
  }

  fundingLevel = async () => {
    let appId = document.getElementById("appid").value
    let appAddress = algosdk.getApplicationAddress(parseInt(appId))
    this.setState({ appAddress: appAddress })
    let balance = await Pipeline.balance(appAddress)
    this.setState({ level: ((balance / (this.state.goal / 1000000)) * 100) })
    this.setState({ fundAmount: balance })
    this.readLocalState(Pipeline.main, this.state.myAddress, appId).then(() => {
      this.readGlobal()
    })

  }

  optIn = async () => {
    let appId = document.getElementById("appid").value
    this.state.appAddress = algosdk.getApplicationAddress(parseInt(appId))
    let args = []
    args.push("register")
    Pipeline.optIn(appId, args).then(data => {
      this.setState({ txID: data });
      setInterval(() => this.fundingLevel(), 5000)
    })
  }

  withdraw = async () => {

    let appId = document.getElementById("appid").value
    let appAddress = algosdk.getApplicationAddress(parseInt(appId))
    let feeAddress = "Z3UAGED6PHNLT4QVUICR5AE7VGCTRZ2VNJSTOBIASI4KCKFCCB3LVJAJKM"

    Pipeline.appCall(appId, ["withdraw"], [appAddress, feeAddress]).then(data => { this.setState({ txID: data }) })
  }

  redeem = async () => {

    let appId = document.getElementById("appid").value

    let appAddress = algosdk.getApplicationAddress(parseInt(appId))

    Pipeline.appCall(appId, ["redeem"], [appAddress]).then(data => { this.setState({ txID: data }) })
  }

  fund = async () => {
    let appId = document.getElementById("appid").value
    let appAddress = algosdk.getApplicationAddress(parseInt(appId))
    let famt = parseInt(document.getElementById("fundAmt").value)
    Pipeline.appCallWithTxn(appId, ["fund"], appAddress, famt, "funding", 0, [appAddress]).then(
      data => { this.setState({ txID: data }) })
  }

  deposit = async () => {
    let appId = document.getElementById("appid").value
    let appAddress = algosdk.getApplicationAddress(parseInt(appId))
    let depositAmt = parseInt(document.getElementById("depAmt").value)
    Pipeline.appCallWithTxn(appId, ["deposit"], appAddress, depositAmt, "depositing", 0, [appAddress]).then(
      data => { this.setState({ txID: data }) })
  }

  modifyTeal = () => {
    let newGoal = document.getElementById("newGoal").value
    let search1 = "BKGZZRBHXOBCD5HMITYZ5CI3V3LS6OMLUT2I7C7QIRU6VA3B2BXUFRN2BE";
    let search2 = "3000000"
    let searchTerms = [search1, search2]
    let replacements = [document.getElementById("recipient").value, newGoal]

    for (let i = 0; i < replacements.length; i++) {
      tealContracts["daoDeposit"].program = tealContracts["daoDeposit"].program.replaceAll(searchTerms[i], replacements[i])
      console.log(tealContracts["daoDeposit"].program)
    }
    this.setState({goal: newGoal})
    alert("Contract modified! Check console log to preview")
  }

  readGlobal = async () => {
    Pipeline.readGlobalState(document.getElementById("appid").value).then(
      data => {
        let keyIndex = ""
        for (let i = 0; i < data.length; i++) {
          let thisKey = window.atob(data[i].key)
          if (thisKey === "ready") {
            keyIndex = i;
            let readyb = data[keyIndex].value.uint
            if (readyb === 1) {
              ready = true
              document.getElementById("fundLevel").style.display = "none"
              document.getElementById("funded").style.display = "block"
            }
          }
          else {
            if (thisKey === "depositAmount") {
              keyIndex = i;
              let damt = data[keyIndex].value.uint
              this.setState({ depositAmount: damt || 0 })
              let contribution = this.state.goal * (100 / this.state.share)
              let owed = damt * (100 / this.state.share)
              this.setState({ myProfits: ((owed - contribution) / 1000000) || 0 })
              this.setState({ contribution: contribution / 1000000 })
            }
          }
        }
      })
  }

  readLocalState = async (net, addr, appIndex) => {

    try {

      let url = ""

      if (!net) {
        url = "https://algoindexer.testnet.algoexplorerapi.io"
      }
      else {
        url = "https://algoindexer.algoexplorerapi.io"
      }

      let appData = await fetch(url + '/v2/accounts/' + addr)
      let appJSON = await appData.json()
      let AppStates = await appJSON.account["apps-local-state"]
      AppStates.forEach(state => {
        if (state.id === parseInt(appIndex)) {
          let keyvalues = state["key-value"]
          keyvalues.forEach(entry => {
            if (entry.key === "YW10") {
              let contribution = entry.value.uint
              this.setState({ share: parseInt((contribution / this.state.goal) * 100) || 0 })
            }
            if (entry.key === "d2l0aGRyYXdu") {
              let withdrawn = entry.value.uint
              this.setState({ withdrawn: withdrawn || 0 })
            }
          })
        }
      })
    }
    catch (error) { console.log(error) }
  }

  startRefresh = () => {
    this.fundingLevel()
    if(!refresh){setInterval(() => this.fundingLevel(),5000)}
    refresh = true
  }

  render() {
    return (
      <div align="center">
        <h1>Dao Deposit</h1>
        <table className="table" width="100%">
          <tbody>
            <tr><td>

              <select onClick={this.setNet}>
                <option>TestNet</option>
                <option>MainNet</option>
              </select>
              <h2>{this.state.net}</h2>
              <select onChange={this.switchConnector}>
                <option>myAlgoWallet</option>
                <option>WalletConnect</option>
                <option>AlgoSigner</option>
              </select>

              <button onClick={this.handleConnect}>Click to Connect</button><br></br>
              <p>{"Connected Address: " + this.state.myAddress}</p>
              <p>{"Balance: " + this.state.balance}</p>



              <h1>ACTIONS</h1>
              <input type="text" id="recipient" placeholder="recipient address"></input>
              <input type="number" id="newGoal" placeholder="goal in microAlgos"></input>
              <button onClick={this.modifyTeal}>Modify Contract</button><br></br>
              <button onClick={this.deploy}>Deploy Contract</button>
              <button onClick={this.optIn}>Opt In</button>
              <input placeholder="App Id" id="appid" type="number"></input><br></br><br></br>
              <button onClick={this.delete}>Delete App</button>
              <h3>Dao Actions</h3>
              <button onClick={this.withdraw}>Withdraw</button><br></br>
              <button onClick={this.deposit}>Deposit</button>
              <input placeholder="Amount" id="depAmt" type="number"></input><br></br>
              <h3>Investor Actions</h3>
              <button onClick={this.fund}>Fund</button>
              <input placeholder="Amount" id="fundAmt" type="number"></input><br></br>
              <button onClick={this.redeem}>Redeem</button>
            </td><td>

                <p>{"Transaction ID: " + this.state.txID}</p>
                <button onClick={this.startRefresh}>Start Refreshing</button>
                <p>{"Application Address: " + this.state.appAddress}</p>
                <h2>{"Funding Goal: " + this.state.goal / 1000000 + " Algos"}</h2>
                <h2>{"Escrow Balance: " + this.state.fundAmount + " Algos"}</h2>
                <h2 id="fundLevel">{"Funding Level: " + this.state.level + "%"}</h2>
                <h2 id="funded" style={{ display: "none" }}>FUNDED!!!!!!</h2>
                <h2>{"My share: " + this.state.share + "%"}</h2>
                <table width="100%" className="myAccount">
                  <thead align="center">My Investor Account</thead>
                  <tbody>
                    <tr><td>My Contributions:</td><td>{this.state.contribution}</td></tr>
                    <tr><td>Deposited:</td><td>{((this.state.depositAmount * (100 / this.state.share)) / 1000000) || 0}</td></tr>
                    <tr><td>Total Profits:</td><td>{"~ " + this.state.myProfits.toString()}</td></tr>
                    <tr><td>Withdrawn:</td><td>{this.state.withdrawn / 1000000}</td></tr>
                    <tr><td>Available to withdraw:</td><td>{"~ " + ((this.state.depositAmount * (100 / this.state.share) - this.state.withdrawn) / 1000000)}</td></tr>
                  </tbody>
                </table>
              </td></tr>
          </tbody>
        </table>
      </div >

    );
  }
}

export default App;
