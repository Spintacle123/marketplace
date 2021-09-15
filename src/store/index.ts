import { IMarketFilter } from '@/interface/filters.interface';
import { IWeb3Instance } from '@/interface/web3instance.interface';
import Vue from 'vue'
import Vuex from 'vuex'
import { BASE_API_URL } from '../const/environments';
import Web3 from 'web3';
import createKeccakHash from 'keccak';
import _, { isUndefined } from 'lodash';

import { Contracts } from '../interface/Contracts';
import { INTERFACE_ID_TRANSFER_COOLDOWNABLE, setUpContracts } from '../contracts';

import {
  marketFilterToQueryDict,
  objToQueryParams
} from '../utils/route.utils';
let web3Instance : IWeb3Instance;
let tmpHax: Web3;

Vue.use(Vuex);

const defaultCallOptions = (state: IState) => ({ from: state.defaultAccount });

function toChecksumAddress(address: string) {
  address = address.toLowerCase().replace('0x', '')
  const hash = createKeccakHash('keccak256').update(address).digest('hex')
  let ret = '0x'

  for (let i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      ret += address[i].toUpperCase()
    } else {
      ret += address[i]
    }
  }

  return ret
}

interface IWeapon {
  id:            string;
  price:         number;
  weaponID:      string;
  weaponStars:   number;
  weaponElement: string;
  stat1Element:  string;
  stat1Value:    number;
  stat2Element:  string;
  stat2Value:    number;
  stat3Element:  string;
  stat3Value:    number;
  timestamp:     number;
  sellerAddress: string;
  buyerAddress:  null;
  network:       string;
}
export interface IState {
  contracts: Contracts,
  defaultAccount: string,
  currentWalletAddress : string,
  currenSkillBalance: number,
  currentBNBBalance  : number,
  chainId: string,
  metamaskConnected: boolean,
  weaponsList : any,
  weaponListFilter: IMarketFilter
}


export const store = new Vuex.Store<IState>({
  state: {
    contracts: null!,
    defaultAccount: '',
    chainId: '',
    currentWalletAddress: '',
    currentBNBBalance : 0.00,
    currenSkillBalance : 0.00,
    metamaskConnected: false,
    weaponsList : [],
    weaponListFilter: {
      elementFilter: [],
      rarityFilter: []
    }
  },
  mutations: {
    setWeaponListFilter(state, payload) {
      state.weaponListFilter = payload.filter;
    },
    setCurrenSkillBalance(state, payload) {
      state.currenSkillBalance = payload
    }, 
    setCurrentBNBBalance(state, payload) {
      state.currentBNBBalance = payload
    }, 
    setCurrentWalletAddress (state, payload) {
      state.currentWalletAddress = payload
    },
    setDefaultAaccount (state, payload) {
      state.defaultAccount = payload
    },
    setChainId (state, payload) {
      state.chainId = payload
    },
    setMetamaskConnected (state, payload) {
        state.metamaskConnected = payload;
    },
    setWeaponsList: (state, weapons) => (state.weaponsList = weapons),
    getWeaponsList: function(state, payload) {
      state.weaponsList = payload
    },
    clearWeaponListFilter(state) {
      state.weaponListFilter = {
        elementFilter: [],
        rarityFilter: []
      };
    },
    setContracts(state: IState, payload) {
      state.contracts = payload;
    },
 },
  actions: {
    async initialize({ dispatch }) {
      console.log('inside initialize');
      await dispatch('setUpContracts');
    },
    async getMetamaskProvider() {
      // check window ethereum provider
      if (window.ethereum) {
        const web3 = new Web3(window.ethereum);
        tmpHax = web3;
        try {
          await window.ethereum.enable()
          web3Instance = web3;
          
        } catch(error) {
          console.log('error',error);
        }
        console.log('------------- web3 instance -------------------');
        console.log(web3Instance);
      } else {
       console.log('Please install Metamask');
      }
    },
    async getMetamaskInformation({ dispatch }) {
      // step 1: check window ethereum provider
      await dispatch('getMetamaskProvider')
      if (!web3Instance) {
        console.error('please install metamask');
        return
      }
  
      // step 2: get account
      await dispatch('getMetamaskAccount')
    },
    async fetchWeaponsList({ commit }) {
      try {
          const response = await fetch(`${BASE_API_URL}/static/market/weapon${objToQueryParams(marketFilterToQueryDict(this.state.weaponListFilter))}`);
          const data = await response.json();

          commit('setWeaponsList', data.results);
      } catch (error) {
          console.error(error);
      }
    },
    async getMetamaskAccount({ commit, dispatch }) {
      const web3 = new Web3(window.ethereum);
      web3Instance = web3;
      await web3Instance.eth.getAccounts()
        .then(async accounts => {
          if (accounts.length > 0) {
            await dispatch('getAccountBalance', accounts[0])
            // 'Success to connect account'
          } else {
            // Failed to connect account'
          }
        })
        .catch((error: string) => {
          throw error
        })
    },
    async getAccountBalance({ commit }, account) {
      await web3Instance.eth.getBalance(toChecksumAddress(account))
        .then((balance: number) => {
          commit('setCurrentBNBBalance', Math.round(balance / (Math.pow(10, 18)) * 100) / 100);
          console.log(Math.round(balance / (Math.pow(10, 18)) * 100) / 100);
        })
        .catch((error: string) => {
          throw error
        })
    },
    async setUpContracts({ commit }) {
      console.log('before setup');
      const contracts = await setUpContracts(tmpHax);
      console.log('help');
      console.log(contracts);
      console.log('me');
      commit('setContracts', contracts);
    },
    async purchaseWeaponListing({ state, dispatch }, { tokenId, maxPrice }: { nftContractAddr: string, tokenId: string, maxPrice: string }) {
      console.log('help');
      console.log(state.contracts);
      console.log('me');
      const { SkillToken,  NFTMarket, Weapons } = state.contracts;
      if(NFTMarket) console.log('found market');
      else console.log('no market');

      if(Weapons) console.log('found Weapons');
      else console.log('no Weapons');

      if(Weapons) console.log('found SkillToken');
      else console.log('no SkillToken');
      
      if(!SkillToken || !Weapons || !NFTMarket) return;

    
      await SkillToken.methods
      .approve(NFTMarket.options.address, maxPrice)
      .send(defaultCallOptions(state));
      
       const res = await NFTMarket.methods
           .purchaseListing(Weapons.options.address, tokenId, maxPrice)
           .send({
             from: state.defaultAccount,
           });

        const {
           seller,
           nftID,
           price
         } = res.events.PurchasedListing.returnValues;

     console.log('sold =D');
        return { seller, nftID, price } as { seller: string, nftID: string, price: string };
    },
    async fetchWeaponsNftPrice({ state }, { tokenId }) {
      const { Weapons, NFTMarket } = state.contracts;
      if(!Weapons || !NFTMarket) return;

      // returns the listing's price in skill wei
      return await NFTMarket.methods
        .getFinalPrice(
          Weapons.options.address,
          tokenId
        )
        .call(defaultCallOptions(state));
    }
  },
  
  modules: {
  },
  getters : {
      getMetamaskConnected : state => state.metamaskConnected,
      defaultAccount : state => state.defaultAccount,
      currentWalletAddress : state => state.currentWalletAddress,
      currentBNBBalance : state => state.currentBNBBalance,
      allWeapons: (state) => state.weaponsList,
      contracts(state: IState) {
        // our root component prevents the app from being active if contracts
        // are not set up, so we never need to worry about it being null anywhere else
        return _.isFunction(state.contracts) ? state.contracts : null!;
      }
  }
})
