//
//  WatchConnectivityModule.m
//  RUNSTR
//
//  Objective-C bridge for WatchConnectivityModule Swift native module
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WatchConnectivityModule, NSObject)

RCT_EXTERN_METHOD(getWatchState:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(syncCredentialsToWatch:(NSDictionary *)credentials
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
